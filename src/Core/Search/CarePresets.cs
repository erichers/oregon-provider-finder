namespace OregonProviderFinder.Core.Search;

public sealed record CarePreset(string Key, string Label, string[] Phrases, string[] Groups, string[] Codes, string[] Credentials);

public static class CarePresets
{
    public static readonly CarePreset[] All =
    [
        new(
            "psychiatry",
            "Psychiatry",
            ["psychiatr"],
            [],
            ["2084P0800X", "363LP0808X"],
            []),
        new(
            "therapy",
            "Therapy and counseling",
            ["therap", "counsel"],
            ["counselor", "mft", "psychologist"],
            ["1041C0700X"],
            []),
        new(
            "primary_care",
            "Primary care",
            ["primary care", "family doctor", "family medicine"],
            [],
            ["207Q00000X", "207R00000X", "208D00000X", "363LF0000X", "363LA2200X", "363LP2300X"],
            []),
        new(
            "children",
            "Children and teens",
            ["child", "teen", "pediatric", "adolescent"],
            [],
            ["208000000X", "363LP0200X", "103TC2200X"],
            []),
        new(
            "substance_use",
            "Substance use",
            ["substance", "addiction", "alcohol", "opioid"],
            [],
            ["101YA0400X", "207LA0401X", "207QA0401X", "207RA0401X", "2083A0300X", "2084A0401X"],
            ["CADC"]),
    ];

    public static CarePreset? Find(string? key)
        => All.FirstOrDefault(preset => string.Equals(preset.Key, key, StringComparison.OrdinalIgnoreCase));
}
