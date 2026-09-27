using System.Diagnostics;
using Microsoft.EntityFrameworkCore;
using OregonProviderFinder.Core.Data;
using OregonProviderFinder.Core.Nppes;
using OregonProviderFinder.Core.Search;

namespace OregonProviderFinder.Api.Search;

public sealed class InterpretService(AppDbContext db, IHttpClientFactory http, IConfiguration configuration, ChainStatusStore status)
{
    public async Task<InterpretResponse> InterpretAsync(string text, CancellationToken cancellationToken)
    {
        var options = configuration.GetSection("Llm").Get<LlmOptions>() ?? new LlmOptions();
        var budget = TimeSpan.FromSeconds(Math.Max(1, options.TotalBudgetSeconds));
        var watch = Stopwatch.StartNew();
        var run = await LlmChain.RunAsync(
            http.CreateClient("llm"),
            options,
            Keys,
            text,
            poisonProvider: null,
            stopOnSuccess: true,
            budget,
            cancellationToken);
        status.Record(run.Attempts);
        var draft = run.Draft ?? RulesInterpreter.Read(text);
        var engine = run.Draft is null
            ? new EngineInfo("rules", null)
            : new EngineInfo(run.Provider ?? "rules", run.Model);
        var response = await ResolveAsync(draft, engine, watch.ElapsedMilliseconds, cancellationToken);
        return response;
    }

    private string[] Keys(string provider)
        => configuration.GetSection($"Llm:{provider}:Keys").GetChildren()
            .Select(child => child.Value)
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(value => value ?? "")
            .ToArray();

    private async Task<InterpretResponse> ResolveAsync(SearchDraft draft, EngineInfo engine, long ms, CancellationToken cancellationToken)
    {
        var groups = new List<string>();
        var specialties = new List<string>();
        var credentials = new List<string>();
        var understood = new List<UnderstoodItem>();
        var unsupported = new List<string>();
        string? preset = null;

        if (CarePresets.Find(draft.Preset) is { } care)
        {
            preset = care.Key;
            understood.Add(new UnderstoodItem("preset", care.Label));
        }

        foreach (var key in draft.Groups.Distinct(StringComparer.Ordinal))
        {
            var known = TaxonomyGroups.All.FirstOrDefault(item => item.Key == key);
            if (known.Key is null)
            {
                continue;
            }

            groups.Add(known.Key);
            understood.Add(new UnderstoodItem("group", known.Label));
        }

        if (!string.IsNullOrWhiteSpace(draft.Specialty))
        {
            var matches = await MatchSpecialtiesAsync(draft.Specialty, cancellationToken);
            if (matches.Count == 0)
            {
                unsupported.Add("No specialty in the registry matched that phrase, so it was left out.");
            }
            else
            {
                specialties.AddRange(matches.Select(item => item.Code));
                understood.Add(new UnderstoodItem("specialty", matches[0].Name));
            }
        }

        foreach (var token in draft.Credentials.Distinct(StringComparer.Ordinal))
        {
            if (!CredentialTokenizer.IsKnown(token))
            {
                continue;
            }

            credentials.Add(token);
            understood.Add(new UnderstoodItem("credential", token));
        }

        string? near = null;
        if (!string.IsNullOrWhiteSpace(draft.Place))
        {
            var place = await PlaceResolver.FindAsync(db, draft.Place, cancellationToken);
            if (place is null)
            {
                unsupported.Add($"I couldn't find {Clean(draft.Place)} in Oregon.");
            }
            else
            {
                near = place.Label;
                understood.Add(new UnderstoodItem("place", place.Label));
            }
        }

        var radius = Math.Clamp(draft.Radius ?? 25, 1, 100);
        if (draft.Radius is not null)
        {
            understood.Add(new UnderstoodItem("radius", $"{radius} miles"));
        }

        string? sex = draft.Sex is "F" or "M" ? draft.Sex : null;
        if (sex == "F")
        {
            understood.Add(new UnderstoodItem("sex", "Women"));
        }
        else if (sex == "M")
        {
            understood.Add(new UnderstoodItem("sex", "Men"));
        }

        string? name = string.IsNullOrWhiteSpace(draft.Name) ? null : Clean(draft.Name);
        if (name is not null)
        {
            understood.Add(new UnderstoodItem("name", name));
        }

        foreach (var key in draft.Unsupported.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            var sentence = LlmDraftParser.Sentence(key);
            if (sentence is not null)
            {
                unsupported.Add(sentence);
            }
        }

        var filters = new InterpretFilters(preset, groups, specialties, credentials, near, radius, sex, name);
        return new InterpretResponse(filters, understood, unsupported, engine, ms);
    }

    private async Task<List<(string Code, string Name)>> MatchSpecialtiesAsync(string phrase, CancellationToken cancellationToken)
    {
        var code = phrase.Trim().ToUpperInvariant();
        if (code.Length == 10 && code.All(char.IsLetterOrDigit))
        {
            var exact = await db.Taxonomies.AsNoTracking().FirstOrDefaultAsync(item => item.Code == code, cancellationToken);
            if (exact is not null)
            {
                return [(exact.Code, exact.DisplayName)];
            }
        }

        var rows = await db.Taxonomies.AsNoTracking()
            .Select(item => new { item.Code, item.DisplayName, Score = EF.Functions.TrigramsSimilarity(item.DisplayName, phrase) })
            .Where(item => item.Score >= 0.35)
            .OrderByDescending(item => item.Score)
            .Take(5)
            .ToListAsync(cancellationToken);
        return rows.Select(item => (item.Code, item.DisplayName)).ToList();
    }

    private static string Clean(string value)
    {
        var text = new string(value.Where(ch => !char.IsControl(ch)).ToArray()).Trim();
        return text.Length <= 80 ? text : text[..80];
    }
}
