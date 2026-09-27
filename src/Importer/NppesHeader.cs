using CsvHelper;
using OregonProviderFinder.Core.Nppes;

namespace OregonProviderFinder.Importer;

sealed class NppesHeader
{
    public required int Npi { get; init; }
    public required int Entity { get; init; }
    public required int Last { get; init; }
    public required int First { get; init; }
    public required int Middle { get; init; }
    public required int Prefix { get; init; }
    public required int Suffix { get; init; }
    public required int Credential { get; init; }
    public required int Address1 { get; init; }
    public required int Address2 { get; init; }
    public required int City { get; init; }
    public required int State { get; init; }
    public required int Postal { get; init; }
    public required int Phone { get; init; }
    public required int Enumeration { get; init; }
    public required int Updated { get; init; }
    public required int Deactivation { get; init; }
    public required int Reactivation { get; init; }
    public required int Sex { get; init; }
    public required (int Code, int License, int LicenseState, int Primary)[] Taxonomy { get; init; }

    public static NppesHeader Read(CsvReader csv)
    {
        int Idx(string name)
        {
            var index = csv.GetFieldIndex(name, isTryGet: true);
            if (index < 0)
            {
                throw new InvalidOperationException($"NPPES header is missing {name}.");
            }

            return index;
        }

        var taxonomy = new (int, int, int, int)[15];
        for (var i = 1; i <= 15; i++)
        {
            taxonomy[i - 1] = (
                Idx($"Healthcare Provider Taxonomy Code_{i}"),
                Idx($"Provider License Number_{i}"),
                Idx($"Provider License Number State Code_{i}"),
                Idx($"Healthcare Provider Primary Taxonomy Switch_{i}"));
        }

        return new NppesHeader
        {
            Npi = Idx("NPI"),
            Entity = Idx("Entity Type Code"),
            Last = Idx("Provider Last Name (Legal Name)"),
            First = Idx("Provider First Name"),
            Middle = Idx("Provider Middle Name"),
            Prefix = Idx("Provider Name Prefix Text"),
            Suffix = Idx("Provider Name Suffix Text"),
            Credential = Idx("Provider Credential Text"),
            Address1 = Idx("Provider First Line Business Practice Location Address"),
            Address2 = Idx("Provider Second Line Business Practice Location Address"),
            City = Idx("Provider Business Practice Location Address City Name"),
            State = Idx("Provider Business Practice Location Address State Name"),
            Postal = Idx("Provider Business Practice Location Address Postal Code"),
            Phone = Idx("Provider Business Practice Location Address Telephone Number"),
            Enumeration = Idx("Provider Enumeration Date"),
            Updated = Idx("Last Update Date"),
            Deactivation = Idx("NPI Deactivation Date"),
            Reactivation = Idx("NPI Reactivation Date"),
            Sex = Idx("Provider Sex Code"),
            Taxonomy = taxonomy,
        };
    }

    public List<TaxonomySlot> Slots(CsvReader csv)
    {
        var slots = new List<TaxonomySlot>();
        foreach (var (codeIndex, licenseIndex, stateIndex, primaryIndex) in Taxonomy)
        {
            var code = csv.GetField(codeIndex)?.Trim();
            if (string.IsNullOrEmpty(code))
            {
                continue;
            }

            var licenseState = csv.GetField(stateIndex)?.Trim();
            slots.Add(new TaxonomySlot
            {
                Code = code,
                IsPrimary = string.Equals(csv.GetField(primaryIndex)?.Trim(), "Y", StringComparison.OrdinalIgnoreCase),
                LicenseNumber = csv.GetField(licenseIndex),
                LicenseState = licenseState is { Length: <= 2 } ? licenseState : null,
            });
        }

        return slots;
    }
}
