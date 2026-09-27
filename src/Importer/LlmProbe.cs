using Microsoft.Extensions.Configuration;
using OregonProviderFinder.Core.Search;

namespace OregonProviderFinder.Importer;

static class LlmProbe
{
    public static async Task<int> RunAsync(string repo, string? poison)
    {
        var configuration = new ConfigurationBuilder()
            .AddJsonFile(Path.Combine(repo, "src", "Api", "appsettings.json"), optional: false)
            .AddUserSecrets(typeof(LlmProbe).Assembly, optional: true)
            .Build();
        var options = configuration.GetSection("Llm").Get<LlmOptions>() ?? new LlmOptions();
        const string prompt = "nurse practitioner in Salem within 10 miles";
        using var http = new HttpClient();
        var budget = poison is null ? (TimeSpan?)null : TimeSpan.FromSeconds(Math.Max(1, options.TotalBudgetSeconds));
        var run = await LlmChain.RunAsync(
            http,
            options,
            provider => Keys(configuration, provider),
            prompt,
            poison,
            stopOnSuccess: poison is not null,
            budget,
            CancellationToken.None);

        Console.WriteLine("prompt: nurse practitioner in Salem within 10 miles");
        if (poison is not null)
        {
            Console.WriteLine($"poison: {poison}");
        }

        foreach (var attempt in run.Attempts)
        {
            var model = attempt.Model.Length == 0 ? "-" : attempt.Model;
            Console.WriteLine($"{attempt.Provider.ToLowerInvariant()} {model} {attempt.Outcome} {attempt.Status} {attempt.Milliseconds}ms");
        }

        if (run.Draft is null)
        {
            Console.WriteLine("answered: rules");
        }
        else
        {
            Console.WriteLine($"answered: {run.Provider} {run.Model}");
            Console.WriteLine("groups: " + string.Join(",", run.Draft.Groups));
            Console.WriteLine("preset: " + (run.Draft.Preset ?? "-"));
            Console.WriteLine("place: " + (run.Draft.Place ?? "-"));
        }

        return run.Attempts.Any(attempt => attempt.Outcome == "ok") || poison is not null ? 0 : 1;
    }

    private static string[] Keys(IConfiguration configuration, string provider)
        => configuration.GetSection($"Llm:{provider}:Keys").GetChildren()
            .Select(child => child.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value ?? "")
            .ToArray();
}
