using Microsoft.AspNetCore.Mvc;
using OregonProviderFinder.Api.Search;

namespace OregonProviderFinder.Api.Controllers;

[ApiController]
[Route("api/providers")]
public sealed class ProvidersController(ProviderSearch search) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Search(
        [FromQuery] string? q,
        [FromQuery] string? groups,
        [FromQuery] string? specialties,
        [FromQuery] string? credentials,
        [FromQuery] string? preset,
        [FromQuery] string? near,
        [FromQuery] int? radius,
        [FromQuery] string? sex,
        [FromQuery] string? sort,
        [FromQuery] int? page,
        [FromQuery] int? pageSize,
        [FromQuery] double? minLat,
        [FromQuery] double? minLng,
        [FromQuery] double? maxLat,
        [FromQuery] double? maxLng,
        CancellationToken cancellationToken)
    {
        try
        {
            var criteria = CriteriaParser.Parse(q, groups, specialties, credentials, preset, near, radius, sex, sort, page, pageSize, minLat, minLng, maxLat, maxLng);
            return Ok(await search.SearchAsync(criteria, cancellationToken));
        }
        catch (SearchRejectedException ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    [HttpGet("map")]
    public async Task<IActionResult> Map(
        [FromQuery] string? q,
        [FromQuery] string? groups,
        [FromQuery] string? specialties,
        [FromQuery] string? credentials,
        [FromQuery] string? preset,
        [FromQuery] string? near,
        [FromQuery] int? radius,
        [FromQuery] string? sex,
        CancellationToken cancellationToken)
    {
        try
        {
            var criteria = CriteriaParser.Parse(q, groups, specialties, credentials, preset, near, radius, sex, sort: "name", page: 1, pageSize: 20);
            return Ok(await search.MapAsync(criteria, cancellationToken));
        }
        catch (SearchRejectedException ex)
        {
            return Problem(detail: ex.Message, statusCode: StatusCodes.Status400BadRequest);
        }
    }

    [HttpGet("{npi}")]
    public async Task<IActionResult> Detail(string npi, CancellationToken cancellationToken)
    {
        if (npi.Length != 10 || npi.Any(ch => !char.IsDigit(ch)))
        {
            return Problem(detail: "NPI must be 10 digits.", statusCode: StatusCodes.Status400BadRequest);
        }

        var detail = await search.DetailAsync(npi, cancellationToken);
        return detail is null ? NotFound() : Ok(detail);
    }
}
