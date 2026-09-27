using OregonProviderFinder.Core.Search;

namespace OregonProviderFinder.Core.Tests;

public class RulesInterpreterTests
{
    [Fact]
    public void Nurse_practitioner_in_Salem_sets_group_place_and_radius()
    {
        var draft = RulesInterpreter.Read("nurse practitioner in Salem within 10 miles");

        Assert.Contains("nurse_practitioner", draft.Groups);
        Assert.Equal("Salem", draft.Place);
        Assert.Equal(10, draft.Radius);
    }

    [Fact]
    public void Insurance_is_an_unsupported_category()
    {
        var draft = RulesInterpreter.Read("counselor in Bend who takes Aetna");

        Assert.Equal("therapy", draft.Preset);
        Assert.Contains("insurance", draft.Unsupported);
        Assert.Equal("Bend", draft.Place);
    }

    [Fact]
    public void Parser_drops_unknown_groups_and_keeps_known_credentials()
    {
        var ok = LlmDraftParser.TryParse(
            """{"groups":["nope","counselor"],"credentials":["LPC","ZZZ"],"place":"Eugene","unsupported":["insurance"]}""",
            out var draft);

        Assert.True(ok);
        Assert.Equal(["counselor"], draft.Groups);
        Assert.Equal(["LPC"], draft.Credentials);
        Assert.Equal("Eugene", draft.Place);
        Assert.Contains("insurance", draft.Unsupported);
        Assert.False(LlmDraftParser.TryParse("not json", out _));
    }
}
