using OregonProviderFinder.Core.Nppes;

namespace OregonProviderFinder.Core.Tests;

public class ProviderFilterTests
{
    [Fact]
    public void Keeps_an_Oregon_counselor_from_the_September_2026_file()
    {
        var fields = Row(
            entity: "1",
            last: "GRANT",
            state: "OR",
            deactivation: "",
            codes: ["101YM0800X", "101YP2500X"]);

        Assert.True(ProviderFilter.TryKeep(fields, out var groups));
        Assert.Equal(["counselor"], groups);
    }

    [Fact]
    public void Keeps_an_Oregon_physician_from_the_September_2026_file()
    {
        var fields = Row(
            entity: "1",
            last: "CHANG",
            state: "OR",
            deactivation: "",
            codes: ["207RH0003X"]);

        Assert.True(ProviderFilter.TryKeep(fields, out var groups));
        Assert.Equal(["physician"], groups);
    }

    [Fact]
    public void Drops_the_Washington_physician_organization_and_deactivated_rows()
    {
        Assert.False(ProviderFilter.TryKeep(Row("1", "LEEDS", "WA", "", ["207V00000X"]), out _));
        Assert.False(ProviderFilter.TryKeep(Row("2", "", "NC", "", ["251G00000X"]), out _));
        Assert.False(ProviderFilter.TryKeep(Row("1", "OBERDICK", "TN", "05/23/2005", ["207Q00000X"]), out _));
    }

    [Theory]
    [InlineData("MA, LPC", "MA", "LPC")]
    [InlineData("M.D.", "MD")]
    [InlineData("MD", "MD")]
    [InlineData("LPC, CADC II", "LPC", "CADC")]
    [InlineData("PMHNP-BC", "PMHNP")]
    [InlineData("PA-C", "PA-C")]
    public void Tokenizes_real_credential_strings(string raw, params string[] expected)
    {
        Assert.Equal(expected, CredentialTokenizer.Tokenize(raw));
    }

    [Fact]
    public void Zip_and_phone_use_the_registry_shapes()
    {
        Assert.Equal("97301", ProviderFilter.Zip5("973018340"));
        Assert.Equal("97223", ProviderFilter.Zip5("972238514"));
        Assert.Equal("5035550100", ProviderFilter.Phone("(503) 555-0100"));
        Assert.Equal("5035550100", ProviderFilter.Phone("15035550100"));
        Assert.Null(ProviderFilter.Phone("555"));
    }

    private static NppesFields Row(string entity, string last, string state, string deactivation, string[] codes)
        => new()
        {
            EntityType = entity,
            LastName = last,
            State = state,
            DeactivationDate = deactivation,
            Slots = codes.Select(code => new TaxonomySlot { Code = code }).ToArray(),
        };
}
