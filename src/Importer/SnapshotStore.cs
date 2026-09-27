using System.IO.Compression;
using System.Text.Json;
using Npgsql;

namespace OregonProviderFinder.Importer;

static class SnapshotStore
{
    private static readonly string[] ProviderColumns =
    [
        "npi", "first_name", "middle_name", "last_name", "prefix", "suffix", "full_name",
        "credential_text", "credentials", "sex", "address_line1", "address_line2", "city",
        "zip5", "phone", "lat", "lng", "location_precision", "group_keys",
        "primary_taxonomy_code", "specialty_labels", "enumeration_date", "registry_last_updated",
    ];

    public static async Task<long> ExportAsync(string connectionString, string repo)
    {
        var dir = Path.Combine(repo, "data", "snapshot");
        Directory.CreateDirectory(dir);
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await CopyOutAsync(conn, ProviderColumns, "providers", Path.Combine(dir, "providers.csv.gz"), "npi");
        await CopyOutAsync(conn, ["npi", "code", "is_primary", "license_number", "license_state"], "provider_taxonomies", Path.Combine(dir, "provider_taxonomies.csv.gz"), "npi, code, id");
        await CopyOutAsync(conn, ["npi", "address_line1", "address_line2", "city", "state", "postal_code", "phone"], "provider_locations", Path.Combine(dir, "provider_locations.csv.gz"), "npi, id");

        var providers = await CountAsync(conn, "providers");
        var taxonomies = await CountAsync(conn, "provider_taxonomies");
        var asOf = await ScalarTextAsync(conn, "SELECT data_as_of::text FROM import_runs WHERE kind = 'full' AND status = 'ok' ORDER BY id DESC LIMIT 1");
        var source = await ScalarTextAsync(conn, "SELECT source_name FROM import_runs WHERE kind = 'full' AND status = 'ok' ORDER BY id DESC LIMIT 1");
        var meta = new
        {
            dataAsOf = asOf,
            sourceFile = source,
            providerRows = providers,
            taxonomyRows = taxonomies,
        };
        await File.WriteAllTextAsync(Path.Combine(dir, "meta.json"), JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
        return new DirectoryInfo(dir).EnumerateFiles().Sum(file => file.Length);
    }

    public static async Task ImportAsync(string connectionString, string repo)
    {
        var dir = Path.Combine(repo, "data", "snapshot");
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();
        await using (var truncate = new NpgsqlCommand("TRUNCATE provider_locations, provider_taxonomies, providers", conn, tx))
        {
            await truncate.ExecuteNonQueryAsync();
        }

        await CopyInAsync(conn, ProviderColumns, "providers", Path.Combine(dir, "providers.csv.gz"));
        await CopyInAsync(conn, ["npi", "code", "is_primary", "license_number", "license_state"], "provider_taxonomies", Path.Combine(dir, "provider_taxonomies.csv.gz"));
        var locationsPath = Path.Combine(dir, "provider_locations.csv.gz");
        if (File.Exists(locationsPath))
        {
            await CopyInAsync(conn, ["npi", "address_line1", "address_line2", "city", "state", "postal_code", "phone"], "provider_locations", locationsPath);
        }
        await ImportSwap.RebuildCitiesAsync(conn, tx);
        await using (var run = new NpgsqlCommand(
            """
            INSERT INTO import_runs (kind, source_name, data_as_of, started_at, finished_at, rows_scanned, rows_kept, status)
            VALUES ('snapshot', $1, $2, NOW(), NOW(), $3, (SELECT count(*) FROM providers), 'ok')
            """, conn, tx))
        {
            var metaPath = Path.Combine(dir, "meta.json");
            string? source = "data/snapshot";
            DateOnly? asOf = null;
            long? scanned = null;
            if (File.Exists(metaPath))
            {
                using var doc = JsonDocument.Parse(await File.ReadAllTextAsync(metaPath));
                var root = doc.RootElement;
                if (root.TryGetProperty("sourceFile", out var sourceFile) && sourceFile.ValueKind == JsonValueKind.String)
                {
                    source = sourceFile.GetString();
                }

                if (root.TryGetProperty("dataAsOf", out var dataAsOf) && dataAsOf.ValueKind == JsonValueKind.String
                    && DateOnly.TryParse(dataAsOf.GetString(), out var parsed))
                {
                    asOf = parsed;
                }

                if (root.TryGetProperty("providerRows", out var providerRows) && providerRows.TryGetInt64(out var rows))
                {
                    scanned = rows;
                }
            }

            run.Parameters.Add(new NpgsqlParameter { Value = source ?? "data/snapshot" });
            run.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlTypes.NpgsqlDbType.Date, Value = asOf.HasValue ? asOf.Value : DBNull.Value });
            run.Parameters.Add(new NpgsqlParameter { Value = scanned.HasValue ? scanned.Value : DBNull.Value });
            await run.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();
    }

    public static async Task<string> ChecksumAsync(string connectionString)
    {
        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        const string sql = """
            SELECT md5(coalesce((
              SELECT string_agg(npi::text || '|' || full_name || '|' || coalesce(city, '') || '|' || coalesce(primary_taxonomy_code, ''), E'\n' ORDER BY npi)
              FROM providers
            ), '')) || '|' || md5(coalesce((
              SELECT string_agg(npi::text || '|' || code || '|' || is_primary::text, E'\n' ORDER BY npi, code, id)
              FROM provider_taxonomies
            ), ''))
            """;
        await using var cmd = new NpgsqlCommand(sql, conn) { CommandTimeout = 0 };
        return (string)(await cmd.ExecuteScalarAsync())!;
    }

    private static async Task CopyOutAsync(NpgsqlConnection conn, string[] columns, string table, string path, string orderBy)
    {
        await using var gzip = new GZipStream(File.Create(path), CompressionLevel.SmallestSize);
        await using var output = new StreamWriter(gzip);
        using var export = conn.BeginTextExport($"COPY (SELECT {string.Join(", ", columns)} FROM {table} ORDER BY {orderBy}) TO STDOUT WITH (FORMAT CSV, HEADER TRUE)");
        while (await export.ReadLineAsync() is { } line)
        {
            await output.WriteLineAsync(line);
        }
    }

    private static async Task CopyInAsync(NpgsqlConnection conn, string[] columns, string table, string path)
    {
        await using var gzip = new GZipStream(File.OpenRead(path), CompressionMode.Decompress);
        using var reader = new StreamReader(gzip);
        using var importer = conn.BeginTextImport($"COPY {table} ({string.Join(", ", columns)}) FROM STDIN WITH (FORMAT CSV, HEADER TRUE)");
        while (await reader.ReadLineAsync() is { } line)
        {
            await importer.WriteLineAsync(line);
        }
    }

    private static async Task<long> CountAsync(NpgsqlConnection conn, string table)
    {
        await using var cmd = new NpgsqlCommand($"SELECT count(*) FROM {table}", conn);
        return (long)(await cmd.ExecuteScalarAsync())!;
    }

    private static async Task<string?> ScalarTextAsync(NpgsqlConnection conn, string sql)
    {
        await using var cmd = new NpgsqlCommand(sql, conn);
        var value = await cmd.ExecuteScalarAsync();
        return value is null or DBNull ? null : value.ToString();
    }
}
