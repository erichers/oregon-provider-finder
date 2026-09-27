using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace OregonProviderFinder.Api.Tests;

public sealed class DirectoryTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Health_responds()
    {
        var response = await factory.CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Meta_reports_the_snapshot()
    {
        var body = await Read("/api/meta");
        Assert.Equal(64780, body.GetProperty("providerCount").GetInt32());
        Assert.Equal("2026-09-13", body.GetProperty("dataAsOf").GetString());
    }

    [Fact]
    public async Task Counselors_near_Salem_match_the_snapshot()
    {
        var body = await Read("/api/providers?groups=counselor&near=Salem&radius=10");
        Assert.Equal(1501, body.GetProperty("total").GetInt32());
        Assert.True(body.GetProperty("items").GetArrayLength() > 0);
    }

    [Fact]
    public async Task Detail_returns_a_real_profile()
    {
        var body = await Read("/api/providers/1548266448");
        Assert.Contains("GRANT", body.GetProperty("fullName").GetString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("97301", body.GetProperty("zip5").GetString());
    }

    [Fact]
    public async Task Missing_npi_is_not_found()
    {
        var response = await factory.CreateClient().GetAsync("/api/providers/0000000000");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Oversized_filters_are_rejected()
    {
        var client = factory.CreateClient();
        var place = await client.GetAsync("/api/providers?near=" + new string('a', 81));
        var page = await client.GetAsync("/api/providers?page=201");
        Assert.Equal(HttpStatusCode.BadRequest, place.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, page.StatusCode);
    }

    [Fact]
    public async Task Unknown_group_is_rejected()
    {
        var response = await factory.CreateClient().GetAsync("/api/providers?groups=not_a_group");
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Locations_skip_one_off_city_spellings()
    {
        var body = await Read("/api/locations?q=port");
        var labels = body.EnumerateArray().Select(item => item.GetProperty("label").GetString()).ToArray();
        Assert.Contains("PORTLAND", labels);
        Assert.DoesNotContain("PORTAND", labels);
        Assert.DoesNotContain("PORTLAN", labels);
    }

    [Fact]
    public async Task Facets_omit_specialties_with_no_name()
    {
        var body = await Read("/api/facets?groups=physician");
        var labels = body.GetProperty("specialties").EnumerateArray().Select(item => item.GetProperty("label").GetString() ?? "");
        Assert.DoesNotContain(labels, label => label.Length == 10 && label.All(char.IsLetterOrDigit));
    }

    [Fact]
    public async Task Facets_count_people_not_taxonomy_rows()
    {
        var facets = await Read("/api/facets?groups=mft");
        var row = facets.GetProperty("specialties").EnumerateArray()
            .First(item => item.GetProperty("code").GetString() == "106H00000X");
        var search = await Read("/api/providers?groups=mft&specialties=106H00000X&pageSize=1");
        Assert.Equal(search.GetProperty("total").GetInt32(), row.GetProperty("count").GetInt32());
    }

    [Fact]
    public async Task Locations_find_Salem()
    {
        var body = await Read("/api/locations?q=salem");
        var labels = body.EnumerateArray().Select(item => item.GetProperty("label").GetString()).ToArray();
        Assert.Contains("SALEM", labels);
    }

    [Fact]
    public async Task Interpret_uses_rules_when_no_keys_are_configured()
    {
        var response = await factory.CreateClient().PostAsJsonAsync("/api/search/interpret", new { text = "counselor in 97301" });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        Assert.Equal("rules", body.RootElement.GetProperty("engine").GetProperty("provider").GetString());
        Assert.Equal("therapy", body.RootElement.GetProperty("filters").GetProperty("preset").GetString());
        Assert.Equal("97301", body.RootElement.GetProperty("filters").GetProperty("near").GetString());
    }

    private async Task<JsonElement> Read(string path)
    {
        var response = await factory.CreateClient().GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var document = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync());
        return document.RootElement.Clone();
    }
}
