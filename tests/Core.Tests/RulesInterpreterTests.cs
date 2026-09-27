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

    [Fact]
    public void The_word_do_is_not_the_credential_DO()
    {
        var draft = RulesInterpreter.Read("who do I see for anxiety in Salem");

        Assert.DoesNotContain("DO", draft.Credentials);
        Assert.Equal("Salem", draft.Place);
    }

    [Fact]
    public void A_capital_DO_and_a_lowercase_lpc_still_match()
    {
        Assert.Contains("DO", RulesInterpreter.Read("a DO in Portland").Credentials);
        Assert.Contains("LPC", RulesInterpreter.Read("an lpc in Bend").Credentials);
    }
}
