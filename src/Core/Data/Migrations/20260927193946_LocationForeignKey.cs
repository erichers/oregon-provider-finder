using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace OregonProviderFinder.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class LocationForeignKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_provider_locations_providers_provider_npi",
                table: "provider_locations");

            migrationBuilder.DropIndex(
                name: "ix_provider_locations_provider_npi",
                table: "provider_locations");

            migrationBuilder.DropColumn(
                name: "provider_npi",
                table: "provider_locations");

            migrationBuilder.AddForeignKey(
                name: "fk_provider_locations_providers_npi",
                table: "provider_locations",
                column: "npi",
                principalTable: "providers",
                principalColumn: "npi",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_provider_locations_providers_npi",
                table: "provider_locations");

            migrationBuilder.AddColumn<string>(
                name: "provider_npi",
                table: "provider_locations",
                type: "character(10)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateIndex(
                name: "ix_provider_locations_provider_npi",
                table: "provider_locations",
                column: "provider_npi");

            migrationBuilder.AddForeignKey(
                name: "fk_provider_locations_providers_provider_npi",
                table: "provider_locations",
                column: "provider_npi",
                principalTable: "providers",
                principalColumn: "npi",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
