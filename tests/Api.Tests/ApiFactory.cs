using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Npgsql;
using System.Text.Json;

namespace OregonProviderFinder.Api.Tests;

public sealed class ApiFactory : WebApplicationFactory<Program>
{
    static ApiFactory()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
    }

    public static string ConnectionString { get; } = Resolve();

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:App", ConnectionString);
    }

    private static string Resolve()
    {
        var fromEnv = Environment.GetEnvironmentVariable("OPF_TEST_CONNECTION");
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            return fromEnv;
        }

        var path = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".microsoft",
            "usersecrets",
            "oregon-provider-finder-api",
            "secrets.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var stored = document.RootElement.GetProperty("ConnectionStrings:App").GetString();
        if (string.IsNullOrWhiteSpace(stored))
        {
            throw new InvalidOperationException("Set OPF_TEST_CONNECTION or ConnectionStrings:App.");
        }

        return new NpgsqlConnectionStringBuilder(stored) { Database = "oregon_providers_test" }.ConnectionString;
    }
}
