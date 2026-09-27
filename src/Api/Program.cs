using System.Threading.RateLimiting;
using Microsoft.EntityFrameworkCore;
using OregonProviderFinder.Api;
using OregonProviderFinder.Api.Search;
using OregonProviderFinder.Core.Data;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

var connectionString = builder.Configuration.GetConnectionString("App");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException("Set ConnectionStrings:App in user-secrets.");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString).UseSnakeCaseNamingConvention());
builder.Services.AddScoped<ProviderSearch>();
builder.Services.AddScoped<InterpretService>();
builder.Services.AddSingleton<ChainStatusStore>();
builder.Services.AddHttpClient("llm");
builder.Services.AddCors();
builder.Services.AddMemoryCache();
builder.Services.AddControllers();
builder.Services.AddProblemDetails();
builder.Services.AddOpenApi();
builder.Services.AddHealthChecks().AddCheck<DatabaseHealthCheck>("database");
builder.Services.AddOutputCache(options =>
{
    options.AddPolicy("facets", policy => policy.Expire(TimeSpan.FromMinutes(10)).SetVaryByQuery("groups"));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("interpret", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 20,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        await Results.Problem(
            title: "Too many requests",
            detail: "Plain-words search is limited to 20 requests a minute.",
            statusCode: StatusCodes.Status429TooManyRequests).ExecuteAsync(context.HttpContext);
    };
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseCors(policy => policy.WithOrigins("http://localhost:4200").AllowAnyHeader().AllowAnyMethod());
    app.MapOpenApi();
    app.MapScalarApiReference();
}
else
{
    app.UseExceptionHandler();
}

app.UseRateLimiter();
app.UseOutputCache();
app.MapControllers();
app.MapHealthChecks("/health");
app.Run();

public partial class Program;
