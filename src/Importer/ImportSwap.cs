using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using Npgsql;
using NpgsqlTypes;

namespace OregonProviderFinder.Importer;

static class ImportSwap
{
    public static async Task PrepareStagingAsync(NpgsqlConnection conn)
    {
        const string sql = """
            DROP TABLE IF EXISTS staging_taxonomies;
            DROP TABLE IF EXISTS staging_providers;
            CREATE UNLOGGED TABLE staging_providers (
              npi text NOT NULL,
              first_name text,
              middle_name text,
              last_name text NOT NULL,
              prefix text,
              suffix text,
              full_name text NOT NULL,
              credential_text text,
              credentials text[] NOT NULL,
              sex text,
              address_line1 text,
              address_line2 text,
              city text,
              zip5 text,
              phone text,
              lat double precision,
              lng double precision,
              location_precision text NOT NULL,
              group_keys text[] NOT NULL,
              primary_taxonomy_code text,
              specialty_labels text NOT NULL,
              enumeration_date date,
              registry_last_updated date
            );
            CREATE UNLOGGED TABLE staging_taxonomies (
              npi text NOT NULL,
              code text NOT NULL,
              is_primary boolean NOT NULL,
              license_number text,
              license_state text
            );
            REVOKE ALL ON staging_providers, staging_taxonomies FROM PUBLIC;
            """;
        await using var cmd = new NpgsqlCommand(sql, conn) { CommandTimeout = 0 };
        await cmd.ExecuteNonQueryAsync();
    }

    public static async Task CommitAsync(NpgsqlConnection conn, string? source, DateOnly? asOf, object startedAt, long scanned, long kept)
    {
        const string sql = """
            TRUNCATE provider_taxonomies, providers;
            INSERT INTO providers (
              npi, first_name, middle_name, last_name, prefix, suffix, full_name, credential_text,
              credentials, sex, address_line1, address_line2, city, zip5, phone, lat, lng,
              location_precision, group_keys, primary_taxonomy_code, specialty_labels,
              enumeration_date, registry_last_updated
            )
            SELECT
              npi::char(10), first_name, middle_name, last_name, prefix, suffix, full_name, credential_text,
              credentials, sex, address_line1, address_line2, city, NULLIF(zip5, '')::char(5), phone, lat, lng,
              location_precision, group_keys, primary_taxonomy_code, specialty_labels,
              enumeration_date, registry_last_updated
            FROM staging_providers;

            INSERT INTO provider_taxonomies (npi, code, is_primary, license_number, license_state)
            SELECT npi::char(10), code, is_primary, license_number, NULLIF(license_state, '')
            FROM staging_taxonomies;

            TRUNCATE cities;
            INSERT INTO cities (name, display_name, lat, lng, provider_count)
            SELECT norm, display_name, lat, lng, provider_count
            FROM (
              SELECT norm,
                     (array_agg(city ORDER BY freq DESC, city))[1] AS display_name,
                     sum(lat * freq) / sum(freq) AS lat,
                     sum(lng * freq) / sum(freq) AS lng,
                     sum(freq)::int AS provider_count
              FROM (
                SELECT lower(regexp_replace(btrim(city), '\s+', ' ', 'g')) AS norm,
                       btrim(city) AS city,
                       count(*) AS freq,
                       avg(lat) AS lat,
                       avg(lng) AS lng
                FROM providers
                WHERE location_precision = 'Zip'
                  AND lat IS NOT NULL
                  AND city IS NOT NULL
                  AND btrim(city) <> ''
                GROUP BY 1, 2
              ) by_spelling
              GROUP BY norm
            ) rolled;

            UPDATE providers AS p
            SET lat = c.lat,
                lng = c.lng,
                location_precision = 'City'
            FROM cities AS c
            WHERE p.location_precision = 'None'
              AND p.city IS NOT NULL
              AND lower(regexp_replace(btrim(p.city), '\s+', ' ', 'g')) = c.name;

            INSERT INTO import_runs (kind, source_name, data_as_of, started_at, finished_at, rows_scanned, rows_kept, status)
            VALUES ('full', $1, $2, $3, NOW(), $4, $5, 'ok');

            TRUNCATE staging_providers, staging_taxonomies;
            """;

        await using var tx = await conn.BeginTransactionAsync();
        foreach (var statement in sql.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            await using var cmd = new NpgsqlCommand(statement, conn, tx) { CommandTimeout = 0 };
            if (statement.Contains("$1", StringComparison.Ordinal))
            {
                cmd.Parameters.Add(new NpgsqlParameter { Value = source ?? "" });
                cmd.Parameters.Add(new NpgsqlParameter { NpgsqlDbType = NpgsqlDbType.Date, Value = asOf.HasValue ? asOf.Value : DBNull.Value });
                cmd.Parameters.Add(new NpgsqlParameter { Value = startedAt });
                cmd.Parameters.Add(new NpgsqlParameter { Value = scanned });
                cmd.Parameters.Add(new NpgsqlParameter { Value = kept });
            }

            await cmd.ExecuteNonQueryAsync();
        }

        await tx.CommitAsync();
    }

    public static async Task RebuildCitiesAsync(NpgsqlConnection conn, NpgsqlTransaction tx)
    {
        const string sql = """
            TRUNCATE cities;
            INSERT INTO cities (name, display_name, lat, lng, provider_count)
            SELECT norm, display_name, lat, lng, provider_count
            FROM (
              SELECT norm,
                     (array_agg(city ORDER BY freq DESC, city))[1] AS display_name,
                     sum(lat * freq) / sum(freq) AS lat,
                     sum(lng * freq) / sum(freq) AS lng,
                     sum(freq)::int AS provider_count
              FROM (
                SELECT lower(regexp_replace(btrim(city), '\s+', ' ', 'g')) AS norm,
                       btrim(city) AS city,
                       count(*) AS freq,
                       avg(lat) AS lat,
                       avg(lng) AS lng
                FROM providers
                WHERE location_precision = 'Zip'
                  AND lat IS NOT NULL
                  AND city IS NOT NULL
                  AND btrim(city) <> ''
                GROUP BY 1, 2
              ) by_spelling
              GROUP BY norm
            ) rolled;
            """;
        foreach (var statement in sql.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            await using var cmd = new NpgsqlCommand(statement, conn, tx) { CommandTimeout = 0 };
            await cmd.ExecuteNonQueryAsync();
        }
    }

    public static async Task<Dictionary<string, (double Lat, double Lng)>> LoadZipsAsync(NpgsqlConnection conn)
    {
        var map = new Dictionary<string, (double, double)>(StringComparer.Ordinal);
        await using var cmd = new NpgsqlCommand("SELECT btrim(zip5::text), lat, lng FROM zip_centroids", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            map[reader.GetString(0)] = (reader.GetDouble(1), reader.GetDouble(2));
        }

        return map;
    }

    public static async Task<Dictionary<string, string>> LoadLabelsAsync(NpgsqlConnection conn)
    {
        var map = new Dictionary<string, string>(StringComparer.Ordinal);
        await using var cmd = new NpgsqlCommand("SELECT code, display_name FROM taxonomies", conn);
        await using var reader = await cmd.ExecuteReaderAsync();
        while (await reader.ReadAsync())
        {
            map[reader.GetString(0)] = reader.GetString(1);
        }

        return map;
    }

    public static async Task<object> NowAsync(NpgsqlConnection conn)
    {
        await using var cmd = new NpgsqlCommand("SELECT NOW()", conn);
        return (await cmd.ExecuteScalarAsync())!;
    }

    public static DateOnly? AsOf(string? entryName)
    {
        if (entryName is null)
        {
            return null;
        }

        var match = Regex.Match(entryName, @"(\d{8})-(\d{8})");
        return match.Success
            ? DateOnly.ParseExact(match.Groups[2].Value, "yyyyMMdd", CultureInfo.InvariantCulture)
            : null;
    }

    public static long RssMb()
    {
        using var process = Process.Start(new ProcessStartInfo
        {
            FileName = "ps",
            Arguments = $"-o rss= -p {Environment.ProcessId}",
            RedirectStandardOutput = true,
        });
        var text = process?.StandardOutput.ReadToEnd().Trim();
        return long.TryParse(text, out var kb) ? kb / 1024 : 0;
    }
}
