using System.Globalization;

namespace OregonProviderFinder.Core.Nppes;

public sealed class TaxonomySlot
{
    public required string Code { get; init; }
    public bool IsPrimary { get; init; }
    public string? LicenseNumber { get; init; }
    public string? LicenseState { get; init; }
}

public sealed class NppesFields
{
    public string? EntityType { get; init; }
    public string? LastName { get; init; }
    public string? FirstName { get; init; }
    public string? MiddleName { get; init; }
    public string? Prefix { get; init; }
    public string? Suffix { get; init; }
    public string? CredentialText { get; init; }
    public string? State { get; init; }
    public string? DeactivationDate { get; init; }
    public string? ReactivationDate { get; init; }
    public string? Sex { get; init; }
    public string? PostalCode { get; init; }
    public string? Phone { get; init; }
    public IReadOnlyList<TaxonomySlot> Slots { get; init; } = [];
}

public static class ProviderFilter
{
    public static bool TryKeep(NppesFields fields, out string[] groups)
    {
        groups = [];
        if (fields.EntityType?.Trim() != "1")
        {
            return false;
        }

        if (!string.Equals(fields.State?.Trim(), "OR", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        // A deactivation date with no later reactivation is an inactive NPI.
        // Reactivated rows keep both dates, with reactivation on or after deactivation.
        if (!IsActive(fields.DeactivationDate, fields.ReactivationDate, fields.LastName))
        {
            return false;
        }

        var keys = new List<string>();
        foreach (var slot in fields.Slots)
        {
            var group = TaxonomyGroups.GroupFor(slot.Code);
            if (group is not null && !keys.Contains(group, StringComparer.Ordinal))
            {
                keys.Add(group);
            }
        }

        if (keys.Count == 0)
        {
            return false;
        }

        groups = keys.ToArray();
        return true;
    }

    public static bool IsActive(string? deactivation, string? reactivation, string? lastName)
    {
        if (string.IsNullOrWhiteSpace(lastName))
        {
            return false;
        }

        if (string.IsNullOrWhiteSpace(deactivation))
        {
            return true;
        }

        if (!TryDate(reactivation, out var reactivated) || !TryDate(deactivation, out var deactivated))
        {
            return false;
        }

        return reactivated >= deactivated;
    }

    public static string? Zip5(string? postal)
    {
        if (string.IsNullOrWhiteSpace(postal))
        {
            return null;
        }

        var digits = new string(postal.Where(char.IsDigit).ToArray());
        return digits.Length >= 5 ? digits[..5] : null;
    }

    public static string? Phone(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        var digits = new string(raw.Where(char.IsDigit).ToArray());
        if (digits.Length == 11 && digits[0] == '1')
        {
            digits = digits[1..];
        }

        return digits.Length == 10 ? digits : null;
    }

    public static string? Sex(string? raw)
    {
        var trimmed = raw?.Trim();
        return trimmed is { Length: 1 } ? trimmed.ToUpperInvariant() : null;
    }

    public static DateOnly? Date(string? raw)
        => TryDate(raw, out var date) ? date : null;

    public static string FullName(string? prefix, string? first, string? middle, string? last, string? suffix)
    {
        var parts = new[] { prefix, first, middle, last, suffix }
            .Select(part => part?.Trim())
            .Where(part => !string.IsNullOrEmpty(part));
        return string.Join(' ', parts);
    }

    private static bool TryDate(string? raw, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(raw))
        {
            return false;
        }

        return DateOnly.TryParseExact(raw.Trim(), "MM/dd/yyyy", CultureInfo.InvariantCulture, DateTimeStyles.None, out date)
            || DateOnly.TryParse(raw.Trim(), CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }
}
