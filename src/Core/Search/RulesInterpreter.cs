using System.Text.RegularExpressions;
using OregonProviderFinder.Core.Nppes;

namespace OregonProviderFinder.Core.Search;

public static partial class RulesInterpreter
{
    public static SearchDraft Read(string text)
    {
        var draft = new SearchDraft();
        var lower = text.ToLowerInvariant();

        foreach (var preset in CarePresets.All)
        {
            if (preset.Phrases.Any(phrase => lower.Contains(phrase, StringComparison.Ordinal)))
            {
                draft.Preset = preset.Key;
                break;
            }
        }

        if (draft.Preset is null)
        {
            foreach (var group in GroupPhrases)
            {
                if (group.Key == "physician" && lower.Contains("physician assistant", StringComparison.Ordinal))
                {
                    continue;
                }

                if (group.Phrases.Any(phrase => lower.Contains(phrase, StringComparison.Ordinal)))
                {
                    draft.Groups.Add(group.Key);
                }
            }
        }

        foreach (var token in CredentialTokenizer.KnownTokens)
        {
            // Two-letter tokens are also English words (do, ma). Those match only
            // when the person typed the credential in capitals.
            var comparison = token.Length <= 2 ? StringComparison.Ordinal : StringComparison.OrdinalIgnoreCase;
            if (Word().Matches(text).Any(match => string.Equals(match.Value, token, comparison)))
            {
                draft.Credentials.Add(token);
            }
        }

        var zip = Zip().Match(text);
        if (zip.Success)
        {
            draft.Place = zip.Value;
        }
        else
        {
            var place = Place().Match(text);
            if (place.Success)
            {
                var label = place.Groups[1].Value.Trim().TrimEnd('.', ',');
                string[] trail = ["within", "who", "that", "with", "for", "and", "oregon", "takes"];
                var kept = new List<string>();
                foreach (var word in label.Split(' ', StringSplitOptions.RemoveEmptyEntries))
                {
                    if (trail.Contains(word, StringComparer.OrdinalIgnoreCase))
                    {
                        break;
                    }

                    kept.Add(word);
                }

                label = string.Join(' ', kept);

                if (label.Length > 0)
                {
                    draft.Place = label;
                }
            }
        }

        var miles = Miles().Match(lower);
        if (miles.Success && int.TryParse(miles.Groups[1].Value, out var radius))
        {
            draft.Radius = Math.Clamp(radius, 1, 100);
        }

        if (Female().IsMatch(lower))
        {
            draft.Sex = "F";
        }
        else if (Male().IsMatch(lower))
        {
            draft.Sex = "M";
        }

        foreach (var item in UnsupportedPhrases)
        {
            if (item.Phrases.Any(phrase => lower.Contains(phrase, StringComparison.Ordinal)))
            {
                draft.Unsupported.Add(item.Key);
            }
        }

        return draft;
    }

    private static readonly (string Key, string[] Phrases)[] GroupPhrases =
    [
        ("nurse_practitioner", ["nurse practitioner", "nurse practitioners"]),
        ("physician_assistant", ["physician assistant", "physician assistants"]),
        ("psychologist", ["psychologist", "psychologists"]),
        ("counselor", ["counselor", "counselors"]),
        ("social_worker", ["social worker", "social workers"]),
        ("mft", ["marriage and family", "family therapist"]),
        ("physician", ["physician", "physicians", "psychiatrist"]),
    ];

    private static readonly (string Key, string[] Phrases)[] UnsupportedPhrases =
    [
        ("insurance", ["insurance", "medicaid", "medicare", "aetna", "kaiser"]),
        ("language", ["spanish", "language", "bilingual"]),
        ("condition", ["trauma", "ptsd", "anxiety", "depression", "adhd"]),
        ("availability", ["available", "accepting", "waitlist"]),
        ("telehealth", ["telehealth", "virtual", "online visit"]),
        ("reviews", ["review", "rating", "stars"]),
    ];

    [GeneratedRegex(@"\b97\d{3}\b")]
    private static partial Regex Zip();

    [GeneratedRegex(@"\b(?:in|near|around)\s+((?:[A-Za-z][A-Za-z'-]*)(?:\s+[A-Za-z][A-Za-z'-]*){0,2})", RegexOptions.IgnoreCase)]
    private static partial Regex Place();

    [GeneratedRegex(@"\b(\d{1,3})\s*miles?\b")]
    private static partial Regex Miles();

    [GeneratedRegex(@"\b(female|woman|women)\b")]
    private static partial Regex Female();

    [GeneratedRegex(@"\b(male|man|men)\b")]
    private static partial Regex Male();

    [GeneratedRegex(@"\b[A-Za-z][A-Za-z0-9-]{1,15}\b")]
    private static partial Regex Word();
}
