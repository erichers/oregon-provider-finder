using OregonProviderFinder.Importer;

var repo = RepoPaths.Find();
var connectionString = Connections.Owner();

if (args is ["import", "geo"])
{
    var count = await GeoImport.LoadAsync(connectionString, repo);
    Console.WriteLine($"zip centroids {count}");
    return 0;
}

if (args is ["import", "taxonomy"])
{
    var count = await TaxonomyImport.LoadAsync(connectionString, repo);
    Console.WriteLine($"taxonomy rows {count}");
    return 0;
}

if (args is ["import", "full", ..])
{
    string? file = null;
    var download = false;
    for (var i = 2; i < args.Length; i++)
    {
        if (args[i] == "--download-latest")
        {
            download = true;
        }
        else if (args[i] == "--file" && i + 1 < args.Length)
        {
            file = args[++i];
        }
        else
        {
            Console.Error.WriteLine($"Unknown argument {args[i]}");
            return 1;
        }
    }

    if (download)
    {
        file = await NppesDownload.DownloadLatestAsync(Path.Combine(repo, "data", "downloads"));
    }

    file ??= Path.Combine(repo, "data", "downloads", "NPPES_Data_Dissemination_September_2026_V2.zip");
    if (!File.Exists(file))
    {
        Console.Error.WriteLine("NPPES zip not found. Pass --file or --download-latest.");
        return 1;
    }

    await FullImport.RunAsync(connectionString, repo, file);
    return 0;
}

if (args is ["export", "snapshot"])
{
    var bytes = await SnapshotStore.ExportAsync(connectionString, repo);
    Console.WriteLine($"snapshot bytes {bytes}");
    if (bytes > 25 * 1024 * 1024)
    {
        Console.Error.WriteLine("snapshot exceeds 25 MB");
        return 2;
    }

    return 0;
}

if (args is ["llm", "probe", ..])
{
    string? poison = null;
    for (var i = 2; i < args.Length; i++)
    {
        if (args[i] == "--poison" && i + 1 < args.Length)
        {
            poison = args[++i];
        }
        else
        {
            Console.Error.WriteLine($"Unknown argument {args[i]}");
            return 1;
        }
    }

    return await LlmProbe.RunAsync(repo, poison);
}

if (args is ["import", "snapshot"])
{
    await SnapshotStore.ImportAsync(connectionString, repo);
    Console.WriteLine($"checksum {await SnapshotStore.ChecksumAsync(connectionString)}");
    return 0;
}

if (args is ["checksum"])
{
    Console.WriteLine(await SnapshotStore.ChecksumAsync(connectionString));
    return 0;
}

Console.Error.WriteLine("Commands: import full [--file <zip>] [--download-latest] | import geo | import snapshot | export snapshot | checksum | llm probe [--poison <provider>]");
return 1;
