using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OregonProviderFinder.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class TrigramIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_providers_specialty_trgm",
                table: "providers",
                column: "specialty_labels")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            // A second HasIndex on city replaces the btree, so this one is SQL.
            migrationBuilder.Sql("CREATE INDEX ix_providers_city_trgm ON providers USING gin (city gin_trgm_ops);");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP INDEX IF EXISTS ix_providers_city_trgm;");

            migrationBuilder.DropIndex(
                name: "ix_providers_specialty_trgm",
                table: "providers");
        }
    }
}
