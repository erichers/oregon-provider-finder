namespace OregonProviderFinder.Core.Nppes;

public static class CredentialTokenizer
{
    private static readonly HashSet<string> Known = new(StringComparer.Ordinal)
    {
        "MD", "DO", "NP", "FNP", "PMHNP", "PA", "PA-C", "PHD", "PSYD",
        "LPC", "LCSW", "LMSW", "MSW", "CSWA", "LMFT", "MFT", "CADC", "QMHP",
        "MA", "MS", "MPH", "DNP", "RN", "MSN", "BSN", "EDD",
        "LCPC", "LMHC", "APRN", "ARNP", "CNP",
    };

    public static bool IsKnown(string token) => Known.Contains(token);

    public static IReadOnlyCollection<string> KnownTokens => Known;

    public static string[] Tokenize(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            return [];
        }

        var upper = raw.ToUpperInvariant().Replace(".", "", StringComparison.Ordinal);
        var parts = upper.Split([',', '/', ' ', '\t'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        var found = new List<string>();
        foreach (var part in parts)
        {
            if (Known.Contains(part))
            {
                Add(found, part);
                continue;
            }

            if (!part.Contains('-', StringComparison.Ordinal))
            {
                continue;
            }

            foreach (var bit in part.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                if (Known.Contains(bit))
                {
                    Add(found, bit);
                }
            }
        }

        return found.ToArray();
    }

    private static void Add(List<string> found, string token)
    {
        if (!found.Contains(token, StringComparer.Ordinal))
        {
            found.Add(token);
        }
    }
}
