using Microsoft.EntityFrameworkCore;
using OregonProviderFinder.Core.Entities;

namespace OregonProviderFinder.Core.Data;

public sealed class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Provider> Providers => Set<Provider>();
    public DbSet<ProviderTaxonomy> ProviderTaxonomies => Set<ProviderTaxonomy>();
    public DbSet<ProviderLocation> ProviderLocations => Set<ProviderLocation>();
    public DbSet<Taxonomy> Taxonomies => Set<Taxonomy>();
    public DbSet<ZipCentroid> ZipCentroids => Set<ZipCentroid>();
    public DbSet<City> Cities => Set<City>();
    public DbSet<ImportRun> ImportRuns => Set<ImportRun>();

    public static double MilesBetween(double lat1, double lng1, double lat2, double lng2)
        => throw new InvalidOperationException("miles_between runs in PostgreSQL.");

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasPostgresExtension("pg_trgm");

        modelBuilder.HasDbFunction(typeof(AppDbContext).GetMethod(nameof(MilesBetween))!)
            .HasName("miles_between");

        modelBuilder.Entity<Provider>(entity =>
        {
            entity.HasKey(p => p.Npi);
            entity.Property(p => p.Npi).HasMaxLength(10).IsFixedLength();
            entity.Property(p => p.Zip5).HasMaxLength(5).IsFixedLength();
            entity.Property(p => p.Phone).HasMaxLength(10);
            entity.Property(p => p.Sex).HasMaxLength(1);
            entity.Property(p => p.LocationPrecision).HasMaxLength(8);
            entity.Property(p => p.Credentials).HasColumnType("text[]");
            entity.Property(p => p.GroupKeys).HasColumnType("text[]");
            entity.Property(p => p.SearchVector)
                .HasColumnType("tsvector")
                .HasComputedColumnSql(
                    "to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(specialty_labels, ''))",
                    stored: true);

            entity.HasIndex(p => p.FullName).HasMethod("gin").HasOperators("gin_trgm_ops");
            entity.HasIndex(p => p.SearchVector).HasMethod("gin");
            entity.HasIndex(p => p.GroupKeys).HasMethod("gin");
            entity.HasIndex(p => p.Credentials).HasMethod("gin");
            entity.HasIndex(p => new { p.Lat, p.Lng });
            entity.HasIndex(p => p.Zip5);
            entity.HasIndex(p => p.City);
            entity.HasIndex(p => p.SpecialtyLabels).HasDatabaseName("ix_providers_specialty_trgm").HasMethod("gin").HasOperators("gin_trgm_ops");

            entity.HasMany(p => p.Taxonomies)
                .WithOne(t => t.Provider)
                .HasForeignKey(t => t.Npi)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ProviderTaxonomy>(entity =>
        {
            entity.Property(t => t.Npi).HasMaxLength(10).IsFixedLength();
            entity.Property(t => t.Code).HasMaxLength(10);
            entity.Property(t => t.LicenseState).HasMaxLength(2);
            entity.HasIndex(t => t.Code);
        });

        modelBuilder.Entity<ProviderLocation>(entity =>
        {
            entity.Property(l => l.Npi).HasMaxLength(10).IsFixedLength();
            entity.Property(l => l.State).HasMaxLength(40);
            entity.HasIndex(l => l.Npi);
            entity.HasOne(l => l.Provider)
                .WithMany(p => p.Locations)
                .HasForeignKey(l => l.Npi);
        });

        modelBuilder.Entity<Taxonomy>(entity =>
        {
            entity.HasKey(t => t.Code);
            entity.Property(t => t.Code).HasMaxLength(10);
            entity.Property(t => t.GroupKey).HasMaxLength(32);
        });

        modelBuilder.Entity<ZipCentroid>(entity =>
        {
            entity.HasKey(z => z.Zip5);
            entity.Property(z => z.Zip5).HasMaxLength(5).IsFixedLength();
        });

        modelBuilder.Entity<City>(entity =>
        {
            entity.HasKey(c => c.Name);
            entity.Property(c => c.Name).HasMaxLength(80);
        });

        modelBuilder.Entity<ImportRun>(entity =>
        {
            entity.Property(r => r.Kind).HasMaxLength(16);
            entity.Property(r => r.Status).HasMaxLength(16);
        });
    }
}
