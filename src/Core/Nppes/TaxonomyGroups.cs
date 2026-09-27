namespace OregonProviderFinder.Core.Nppes;

public static class TaxonomyGroups
{
    public static readonly (string Key, string Label)[] All =
    [
        ("physician", "Physicians (MD, DO)"),
        ("nurse_practitioner", "Nurse practitioners"),
        ("physician_assistant", "Physician assistants"),
        ("psychologist", "Psychologists"),
        ("counselor", "Counselors (LPC and others)"),
        ("social_worker", "Social workers"),
        ("mft", "Marriage and family therapists"),
    ];

    public static string? GroupFor(string? code)
    {
        if (string.IsNullOrWhiteSpace(code))
        {
            return null;
        }

        if (code.StartsWith("207", StringComparison.Ordinal) || code.StartsWith("208", StringComparison.Ordinal))
        {
            return "physician";
        }

        if (code.StartsWith("363L", StringComparison.Ordinal))
        {
            return "nurse_practitioner";
        }

        if (code.StartsWith("363A", StringComparison.Ordinal))
        {
            return "physician_assistant";
        }

        if (code.StartsWith("103T", StringComparison.Ordinal) || code == "103G00000X")
        {
            return "psychologist";
        }

        if (code.StartsWith("101Y", StringComparison.Ordinal))
        {
            return "counselor";
        }

        if (code.StartsWith("1041", StringComparison.Ordinal))
        {
            return "social_worker";
        }

        if (code == "106H00000X")
        {
            return "mft";
        }

        return null;
    }
}
