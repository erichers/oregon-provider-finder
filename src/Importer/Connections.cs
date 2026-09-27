using Microsoft.Extensions.Configuration;
using Npgsql;

namespace OregonProviderFinder.Importer;

static class Connections
{
    public static string Owner()
    {
        var fromEnv = Environment.GetEnvironmentVariable("OPF_OWNER_CONNECTION");
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            return fromEnv;
        }

        var config = new ConfigurationBuilder()
            .AddUserSecrets(typeof(Connections).Assembly, optional: true)
            .Build();
        var stored = config["ConnectionStrings:Owner"];
        if (string.IsNullOrWhiteSpace(stored))
        {
            throw new InvalidOperationException("Set ConnectionStrings:Owner in user-secrets, or OPF_OWNER_CONNECTION.");
        }

        return stored;
    }

    public static string WithDatabase(string connectionString, string database)
    {
        var builder = new NpgsqlConnectionStringBuilder(connectionString) { Database = database };
        return builder.ConnectionString;
    }
}

static class RepoPaths
{
    public static string Find()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            var dir = new DirectoryInfo(start);
            while (dir is not null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "OregonProviderFinder.slnx")))
                {
                    return dir.FullName;
                }

                dir = dir.Parent;
            }
        }

        throw new InvalidOperationException("Could not find the repository root.");
    }
}
