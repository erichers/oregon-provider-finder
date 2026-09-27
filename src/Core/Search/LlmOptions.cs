namespace OregonProviderFinder.Core.Search;

public sealed class LlmProviderOptions
{
    public string Name { get; set; } = "";
    public string BaseUrl { get; set; } = "";
    public int TimeoutSeconds { get; set; } = 6;
    public bool JsonResponseFormat { get; set; }
    public bool DisableThinking { get; set; }
    public List<string> Models { get; set; } = [];
}

public sealed class LlmOptions
{
    public int TotalBudgetSeconds { get; set; } = 20;
    public int MaxTokens { get; set; } = 300;
    public List<LlmProviderOptions> Providers { get; set; } = [];
}
