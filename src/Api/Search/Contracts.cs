namespace OregonProviderFinder.Api.Search;

public sealed record ProviderSummary(
    string Npi,
    string FullName,
    string? CredentialText,
    string? PrimarySpecialty,
    string[] Groups,
    string? City,
    string? Zip5,
    string? Phone,
    double? DistanceMiles,
    string LocationPrecision,
    string? AddressLine1,
    double? Lat,
    double? Lng);

public sealed record PlaceCenter(double Lat, double Lng, string Label);

public sealed record SearchResponse(int Total, int Page, int PageSize, PlaceCenter? Center, IReadOnlyList<ProviderSummary> Items);

public sealed record MapPoint(string Zip5, double Lat, double Lng, int Count);

public sealed record TaxonomyItem(string Code, string? DisplayName, bool IsPrimary, string? LicenseNumber, string? LicenseState);

public sealed record ProviderDetail(
    string Npi,
    string FullName,
    string? CredentialText,
    string[] Credentials,
    string? Sex,
    string? AddressLine1,
    string? AddressLine2,
    string? City,
    string? Zip5,
    string? Phone,
    double? Lat,
    double? Lng,
    string LocationPrecision,
    string[] Groups,
    string? PrimarySpecialty,
    string? PrimaryTaxonomyCode,
    DateOnly? EnumerationDate,
    DateOnly? RegistryLastUpdated,
    string RegistryUrl,
    IReadOnlyList<TaxonomyItem> Taxonomies);

public sealed record InterpretFilters(
    string? Preset,
    IReadOnlyList<string> Groups,
    IReadOnlyList<string> Specialties,
    IReadOnlyList<string> Credentials,
    string? Near,
    int Radius,
    string? Sex,
    string? Q);

public sealed record UnderstoodItem(string Kind, string Label);

public sealed record EngineInfo(string Provider, string? Model);

public sealed record InterpretResponse(
    InterpretFilters Filters,
    IReadOnlyList<UnderstoodItem> Understood,
    IReadOnlyList<string> Unsupported,
    EngineInfo Engine,
    long Ms);

public sealed class SearchRejectedException(string detail) : Exception(detail);
