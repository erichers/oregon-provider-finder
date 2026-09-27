using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace OregonProviderFinder.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class SecondaryLocations : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "provider_locations",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    npi = table.Column<string>(type: "character(10)", fixedLength: true, maxLength: 10, nullable: false),
                    address_line1 = table.Column<string>(type: "text", nullable: true),
                    address_line2 = table.Column<string>(type: "text", nullable: true),
                    city = table.Column<string>(type: "text", nullable: true),
                    state = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true),
                    postal_code = table.Column<string>(type: "text", nullable: true),
                    phone = table.Column<string>(type: "text", nullable: true),
                    provider_npi = table.Column<string>(type: "character(10)", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_provider_locations", x => x.id);
                    table.ForeignKey(
                        name: "fk_provider_locations_providers_provider_npi",
                        column: x => x.provider_npi,
                        principalTable: "providers",
                        principalColumn: "npi",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_provider_locations_npi",
                table: "provider_locations",
                column: "npi");

            migrationBuilder.CreateIndex(
                name: "ix_provider_locations_provider_npi",
                table: "provider_locations",
                column: "provider_npi");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "provider_locations");
        }
    }
}
