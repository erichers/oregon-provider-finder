using OregonProviderFinder.Core.Nppes;

namespace OregonProviderFinder.Core.Tests;

public class SecondaryLocationParserTests
{
    [Fact]
    public void Reads_a_secondary_address_and_skips_a_blank_one()
    {
        const string csv = """
            "NPI","Provider Secondary Practice Location Address- Address Line 1","Provider Secondary Practice Location Address-  Address Line 2","Provider Secondary Practice Location Address - City Name","Provider Secondary Practice Location Address - State Name","Provider Secondary Practice Location Address - Postal Code","Provider Secondary Practice Location Address - Country Code (If outside U.S.)","Provider Secondary Practice Location Address - Telephone Number","Provider Secondary Practice Location Address - Telephone Extension","Provider Practice Location Address - Fax Number"
            "1548266448","123 STATE ST","","SALEM","OR","97301","US","5035550100","",""
            "1003827965","","","","","","","","",""
            """;

        var rows = SecondaryLocationParser.Read(new StringReader(csv)).ToArray();

        Assert.Single(rows);
        Assert.Equal("1548266448", rows[0].Npi);
        Assert.Equal("123 STATE ST", rows[0].AddressLine1);
        Assert.Equal("SALEM", rows[0].City);
        Assert.Equal("OR", rows[0].State);
        Assert.Equal("5035550100", rows[0].Phone);
    }
}
