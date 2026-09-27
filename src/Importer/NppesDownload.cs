using System.Text.RegularExpressions;

namespace OregonProviderFinder.Importer;

static class NppesDownload
{
    public static async Task<string> DownloadLatestAsync(string directory)
    {
        Directory.CreateDirectory(directory);
        using var http = new HttpClient();
        var html = await http.GetStringAsync("https://download.cms.gov/nppes/NPI_Files.html");
        var match = Regex.Matches(html, @"https://download\.cms\.gov/nppes/NPPES_Data_Dissemination_[A-Za-z]+_\d{4}_V2\.zip")
            .Select(item => item.Value)
            .LastOrDefault();
        if (match is null)
        {
            throw new InvalidOperationException("Could not find a V.2 dissemination zip on NPI_Files.html.");
        }

        var name = Path.GetFileName(match);
        var dest = Path.Combine(directory, name);
        Console.WriteLine($"downloading {name}");
        await using var stream = await http.GetStreamAsync(match);
        await using var file = File.Create(dest);
        var buffer = new byte[1024 * 256];
        long readTotal = 0;
        int read;
        while ((read = await stream.ReadAsync(buffer)) > 0)
        {
            await file.WriteAsync(buffer.AsMemory(0, read));
            readTotal += read;
            if (readTotal % (50L * 1024 * 1024) < buffer.Length)
            {
                Console.WriteLine($"downloaded {readTotal / (1024 * 1024)} MB");
            }
        }

        return dest;
    }
}
