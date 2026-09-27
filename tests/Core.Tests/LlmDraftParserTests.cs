using OregonProviderFinder.Core.Search;

namespace OregonProviderFinder.Core.Tests;

public class LlmDraftParserTests
{
    [Fact]
    public void Null_radius_is_omitted()
    {
        var ok = LlmDraftParser.TryParse(
            """{"groups":["nurse_practitioner"],"place":"Bend","radius":null}""",
            out var draft);

        Assert.True(ok);
        Assert.Null(draft.Radius);
        Assert.Equal("Bend", draft.Place);
        Assert.Contains("nurse_practitioner", draft.Groups);
    }
}
