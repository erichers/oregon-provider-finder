using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using OregonProviderFinder.Api.Search;

namespace OregonProviderFinder.Api.Controllers;

[ApiController]
public sealed class InterpretController(InterpretService interpret) : ControllerBase
{
    [HttpPost("api/search/interpret")]
    [EnableRateLimiting("interpret")]
    public async Task<IActionResult> Interpret([FromBody] InterpretBody body, CancellationToken cancellationToken)
    {
        var text = body.Text?.Trim() ?? "";
        if (text.Length == 0)
        {
            return Problem(detail: "Text is required.", statusCode: StatusCodes.Status400BadRequest);
        }

        if (text.Length > 300)
        {
            return Problem(detail: "Text is limited to 300 characters.", statusCode: StatusCodes.Status400BadRequest);
        }

        return Ok(await interpret.InterpretAsync(text, cancellationToken));
    }

    public sealed record InterpretBody(string? Text);
}
