using System.Diagnostics;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace OregonProviderFinder.Core.Search;

public static class LlmChain
{
    public static async Task<LlmRun> RunAsync(
        HttpClient http,
        LlmOptions options,
        Func<string, IReadOnlyList<string>> keysFor,
        string text,
        string? poisonProvider,
        bool stopOnSuccess,
        TimeSpan? budget,
        CancellationToken cancellationToken)
    {
        var attempts = new List<LlmAttempt>();
        var started = Stopwatch.StartNew();
        using var budgetCts = new CancellationTokenSource();
        if (budget is { } limit)
        {
            budgetCts.CancelAfter(limit);
        }

        SearchDraft? winner = null;
        string? winnerProvider = null;
        string? winnerModel = null;

        foreach (var provider in options.Providers)
        {
            if (budgetCts.IsCancellationRequested || (stopOnSuccess && winner is not null))
            {
                break;
            }

            var keys = keysFor(provider.Name).Where(value => !string.IsNullOrWhiteSpace(value)).ToArray();
            var poisoned = poisonProvider is not null
                && string.Equals(poisonProvider, provider.Name, StringComparison.OrdinalIgnoreCase);
            if (poisoned)
            {
                keys = ["invalid-key"];
            }
            else if (keys.Length == 0)
            {
                attempts.Add(new LlmAttempt(provider.Name, "", "skipped", 0, 0));
                continue;
            }

            foreach (var model in provider.Models)
            {
                if (budgetCts.IsCancellationRequested || (stopOnSuccess && winner is not null))
                {
                    break;
                }

                foreach (var key in keys)
                {
                    if (budgetCts.IsCancellationRequested || (stopOnSuccess && winner is not null))
                    {
                        break;
                    }

                    var attempt = await TryAsync(http, provider, model, key, text, options.MaxTokens, budgetCts.Token, cancellationToken);
                    attempts.Add(attempt.Attempt);
                    if (attempt.Draft is not null)
                    {
                        if (winner is null)
                        {
                            winner = attempt.Draft;
                            winnerProvider = provider.Name.ToLowerInvariant();
                            winnerModel = model;
                        }

                        if (stopOnSuccess)
                        {
                            break;
                        }
                    }
                }
            }
        }

        return new LlmRun(winner, winnerProvider, winnerModel, started.ElapsedMilliseconds, attempts);
    }

    private static async Task<(LlmAttempt Attempt, SearchDraft? Draft)> TryAsync(
        HttpClient http,
        LlmProviderOptions provider,
        string model,
        string key,
        string text,
        int maxTokens,
        CancellationToken budgetToken,
        CancellationToken cancellationToken)
    {
        var watch = Stopwatch.StartNew();
        using var rung = CancellationTokenSource.CreateLinkedTokenSource(budgetToken, cancellationToken);
        rung.CancelAfter(TimeSpan.FromSeconds(Math.Max(1, provider.TimeoutSeconds)));
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, provider.BaseUrl.TrimEnd('/') + "/chat/completions");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", key);
            request.Content = new StringContent(Body(provider, model, text, maxTokens), Encoding.UTF8, "application/json");
            using var response = await http.SendAsync(request, rung.Token);
            var status = (int)response.StatusCode;
            if (!response.IsSuccessStatusCode)
            {
                return (new LlmAttempt(provider.Name, model, "http", status, watch.ElapsedMilliseconds), null);
            }

            var body = await response.Content.ReadAsStringAsync(rung.Token);
            var content = ReadContent(body);
            if (string.IsNullOrWhiteSpace(content) || !LlmDraftParser.TryParse(content, out var draft))
            {
                var outcome = string.IsNullOrWhiteSpace(content) ? "empty" : "json";
                return (new LlmAttempt(provider.Name, model, outcome, status, watch.ElapsedMilliseconds), null);
            }

            return (new LlmAttempt(provider.Name, model, "ok", status, watch.ElapsedMilliseconds), draft);
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            throw;
        }
        catch (OperationCanceledException)
        {
            var outcome = budgetToken.IsCancellationRequested ? "budget" : "timeout";
            return (new LlmAttempt(provider.Name, model, outcome, 0, watch.ElapsedMilliseconds), null);
        }
        catch (HttpRequestException)
        {
            return (new LlmAttempt(provider.Name, model, "http", 0, watch.ElapsedMilliseconds), null);
        }
        catch (JsonException)
        {
            return (new LlmAttempt(provider.Name, model, "json", 0, watch.ElapsedMilliseconds), null);
        }
    }

    private static string Body(LlmProviderOptions provider, string model, string text, int maxTokens)
    {
        var safe = text.Replace("</user>", "", StringComparison.OrdinalIgnoreCase);
        if (safe.Length > 300)
        {
            safe = safe[..300];
        }

        var payload = new Dictionary<string, object?>
        {
            ["model"] = model,
            ["temperature"] = 0,
            ["max_tokens"] = maxTokens,
            ["messages"] = new object[]
            {
                new { role = "system", content = LlmDraftParser.Prompt },
                new { role = "user", content = "<user>\n" + safe + "\n</user>" },
            },
        };
        if (provider.JsonResponseFormat)
        {
            payload["response_format"] = new { type = "json_object" };
        }

        if (provider.DisableThinking)
        {
            payload["chat_template_kwargs"] = new { thinking = false };
        }

        return JsonSerializer.Serialize(payload);
    }

    private static string? ReadContent(string body)
    {
        using var doc = JsonDocument.Parse(body);
        if (!doc.RootElement.TryGetProperty("choices", out var choices) || choices.GetArrayLength() == 0)
        {
            return null;
        }

        if (!choices[0].TryGetProperty("message", out var message)
            || !message.TryGetProperty("content", out var content)
            || content.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        return content.GetString();
    }
}
