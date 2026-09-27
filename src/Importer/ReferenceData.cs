using System.Globalization;
using Npgsql;

namespace OregonProviderFinder.Importer;

static class GeoImport
{
    public static async Task<int> LoadAsync(string connectionString, string repo)
    {
        var path = Path.Combine(repo, "data", "geo", "oregon-zcta.csv");
        var rows = new List<(string Zip, double Lat, double Lng)>();
        foreach (var line in File.ReadLines(path).Skip(1))
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            var parts = line.Split(',');
            rows.Add((parts[0], double.Parse(parts[1], CultureInfo.InvariantCulture), double.Parse(parts[2], CultureInfo.InvariantCulture)));
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();
        await using (var cmd = new NpgsqlCommand("TRUNCATE zip_centroids", conn, tx))
        {
            await cmd.ExecuteNonQueryAsync();
        }

        await using (var writer = await conn.BeginBinaryImportAsync("COPY zip_centroids (zip5, lat, lng) FROM STDIN (FORMAT BINARY)"))
        {
            foreach (var (zip, lat, lng) in rows)
            {
                await writer.StartRowAsync();
                await writer.WriteAsync(zip, NpgsqlTypes.NpgsqlDbType.Char);
                await writer.WriteAsync(lat, NpgsqlTypes.NpgsqlDbType.Double);
                await writer.WriteAsync(lng, NpgsqlTypes.NpgsqlDbType.Double);
            }

            await writer.CompleteAsync();
        }

        await tx.CommitAsync();
        return rows.Count;
    }
}

static class TaxonomyImport
{
    public static async Task<int> LoadAsync(string connectionString, string repo)
    {
        var path = Path.Combine(repo, "data", "taxonomy", "nucc-subset.csv");
        using var reader = new StreamReader(path);
        using var csv = new CsvHelper.CsvReader(reader, CultureInfo.InvariantCulture);
        await csv.ReadAsync();
        csv.ReadHeader();
        var rows = new List<(string Code, string? Group, string? Classification, string? Specialization, string Display)>();
        while (await csv.ReadAsync())
        {
            var code = csv.GetField("Code")?.Trim() ?? "";
            if (code.Length == 0)
            {
                continue;
            }

            rows.Add((
                code,
                OregonProviderFinder.Core.Nppes.TaxonomyGroups.GroupFor(code),
                csv.GetField("Classification"),
                csv.GetField("Specialization"),
                csv.GetField("Display Name") ?? code));
        }

        await using var conn = new NpgsqlConnection(connectionString);
        await conn.OpenAsync();
        await using var tx = await conn.BeginTransactionAsync();
        await using (var cmd = new NpgsqlCommand("TRUNCATE taxonomies", conn, tx))
        {
            await cmd.ExecuteNonQueryAsync();
        }

        await using (var writer = await conn.BeginBinaryImportAsync(
            "COPY taxonomies (code, group_key, classification, specialization, display_name) FROM STDIN (FORMAT BINARY)"))
        {
            foreach (var row in rows)
            {
                await writer.StartRowAsync();
                await writer.WriteAsync(row.Code, NpgsqlTypes.NpgsqlDbType.Text);
                await WriteText(writer, row.Group);
                await WriteText(writer, row.Classification);
                await WriteText(writer, row.Specialization);
                await writer.WriteAsync(row.Display, NpgsqlTypes.NpgsqlDbType.Text);
            }

            await writer.CompleteAsync();
        }

        await tx.CommitAsync();
        return rows.Count;
    }

    internal static async Task WriteText(NpgsqlBinaryImporter writer, string? value)
    {
        if (string.IsNullOrEmpty(value))
        {
            await writer.WriteNullAsync();
        }
        else
        {
            await writer.WriteAsync(value, NpgsqlTypes.NpgsqlDbType.Text);
        }
    }
}
