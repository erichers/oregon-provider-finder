namespace OregonProviderFinder.Core.Search;

public sealed class SearchDraft
{
    public string? Preset { get; set; }
    public List<string> Groups { get; } = [];
    public string? Specialty { get; set; }
    public List<string> Credentials { get; } = [];
    public string? Place { get; set; }
    public int? Radius { get; set; }
    public string? Sex { get; set; }
    public string? Name { get; set; }
    public List<string> Unsupported { get; } = [];
}

public sealed record LlmAttempt(string Provider, string Model, string Outcome, int Status, long Milliseconds);

public sealed record LlmRun(SearchDraft? Draft, string? Provider, string? Model, long Milliseconds, IReadOnlyList<LlmAttempt> Attempts);
