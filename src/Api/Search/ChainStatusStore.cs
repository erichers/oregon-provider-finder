using OregonProviderFinder.Core.Search;

namespace OregonProviderFinder.Api.Search;

public sealed record RungStatus(string Provider, string Model, string Outcome, int Status, long Milliseconds);

public sealed class ChainStatusStore
{
    private readonly object _gate = new();
    private readonly Dictionary<string, RungStatus> _last = new(StringComparer.OrdinalIgnoreCase);

    public void Record(IEnumerable<LlmAttempt> attempts)
    {
        lock (_gate)
        {
            foreach (var attempt in attempts)
            {
                if (attempt.Model.Length == 0)
                {
                    continue;
                }

                _last[$"{attempt.Provider}|{attempt.Model}"] = new RungStatus(
                    attempt.Provider.ToLowerInvariant(),
                    attempt.Model,
                    attempt.Outcome,
                    attempt.Status,
                    attempt.Milliseconds);
            }
        }
    }

    public IReadOnlyList<RungStatus> Snapshot()
    {
        lock (_gate)
        {
            return _last.Values.ToArray();
        }
    }
}
