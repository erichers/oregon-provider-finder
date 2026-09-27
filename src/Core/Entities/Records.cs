using NpgsqlTypes;

namespace OregonProviderFinder.Core.Entities;

public sealed class Provider
{
    public string Npi { get; set; } = "";
    public string? FirstName { get; set; }
    public string? MiddleName { get; set; }
    public string LastName { get; set; } = "";
    public string? Prefix { get; set; }
    public string? Suffix { get; set; }
    public string FullName { get; set; } = "";
    public string? CredentialText { get; set; }
    public string[] Credentials { get; set; } = [];
    public string? Sex { get; set; }
    public string? AddressLine1 { get; set; }
    public string? AddressLine2 { get; set; }
    public string? City { get; set; }
    public string? Zip5 { get; set; }
    public string? Phone { get; set; }
    public double? Lat { get; set; }
    public double? Lng { get; set; }
    public string LocationPrecision { get; set; } = LocationPrecisionKind.None;
    public string[] GroupKeys { get; set; } = [];
    public string? PrimaryTaxonomyCode { get; set; }
    public string SpecialtyLabels { get; set; } = "";
    public DateOnly? EnumerationDate { get; set; }
    public DateOnly? RegistryLastUpdated { get; set; }
    public NpgsqlTsVector SearchVector { get; set; } = null!;

    public List<ProviderTaxonomy> Taxonomies { get; set; } = [];
}

public sealed class ProviderTaxonomy
{
    public long Id { get; set; }
    public string Npi { get; set; } = "";
    public string Code { get; set; } = "";
    public bool IsPrimary { get; set; }
    public string? LicenseNumber { get; set; }
    public string? LicenseState { get; set; }

    public Provider Provider { get; set; } = null!;
}

public sealed class Taxonomy
{
    public string Code { get; set; } = "";
    public string? GroupKey { get; set; }
    public string? Classification { get; set; }
    public string? Specialization { get; set; }
    public string DisplayName { get; set; } = "";
}

public sealed class ZipCentroid
{
    public string Zip5 { get; set; } = "";
    public double Lat { get; set; }
    public double Lng { get; set; }
}

public sealed class City
{
    public string Name { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public double Lat { get; set; }
    public double Lng { get; set; }
    public int ProviderCount { get; set; }
}

public sealed class ImportRun
{
    public long Id { get; set; }
    public string Kind { get; set; } = "";
    public string? SourceName { get; set; }
    public DateOnly? DataAsOf { get; set; }
    public DateTimeOffset StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public long RowsScanned { get; set; }
    public long RowsKept { get; set; }
    public string Status { get; set; } = "";
    public string? Error { get; set; }
}

public static class LocationPrecisionKind
{
    public const string Zip = "Zip";
    public const string City = "City";
    public const string None = "None";
}
