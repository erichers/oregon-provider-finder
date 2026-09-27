using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;
using NpgsqlTypes;

#nullable disable

namespace OregonProviderFinder.Core.Data.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql(
                """
                CREATE FUNCTION miles_between(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
                RETURNS double precision
                LANGUAGE sql
                IMMUTABLE
                AS $$
                  SELECT 3958.8 * 2 * asin(sqrt(
                    power(sin(radians(lat2 - lat1) / 2), 2)
                    + cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
                  ));
                $$;
                """);

            migrationBuilder.AlterDatabase()
                .Annotation("Npgsql:PostgresExtension:pg_trgm", ",,");

            migrationBuilder.CreateTable(
                name: "cities",
                columns: table => new
                {
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    display_name = table.Column<string>(type: "text", nullable: false),
                    lat = table.Column<double>(type: "double precision", nullable: false),
                    lng = table.Column<double>(type: "double precision", nullable: false),
                    provider_count = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cities", x => x.name);
                });

            migrationBuilder.CreateTable(
                name: "import_runs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    source_name = table.Column<string>(type: "text", nullable: true),
                    data_as_of = table.Column<DateOnly>(type: "date", nullable: true),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    rows_scanned = table.Column<long>(type: "bigint", nullable: false),
                    rows_kept = table.Column<long>(type: "bigint", nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    error = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_import_runs", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "providers",
                columns: table => new
                {
                    npi = table.Column<string>(type: "character(10)", fixedLength: true, maxLength: 10, nullable: false),
                    first_name = table.Column<string>(type: "text", nullable: true),
                    middle_name = table.Column<string>(type: "text", nullable: true),
                    last_name = table.Column<string>(type: "text", nullable: false),
                    prefix = table.Column<string>(type: "text", nullable: true),
                    suffix = table.Column<string>(type: "text", nullable: true),
                    full_name = table.Column<string>(type: "text", nullable: false),
                    credential_text = table.Column<string>(type: "text", nullable: true),
                    credentials = table.Column<string[]>(type: "text[]", nullable: false),
                    sex = table.Column<string>(type: "character varying(1)", maxLength: 1, nullable: true),
                    address_line1 = table.Column<string>(type: "text", nullable: true),
                    address_line2 = table.Column<string>(type: "text", nullable: true),
                    city = table.Column<string>(type: "text", nullable: true),
                    zip5 = table.Column<string>(type: "character(5)", fixedLength: true, maxLength: 5, nullable: true),
                    phone = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    lat = table.Column<double>(type: "double precision", nullable: true),
                    lng = table.Column<double>(type: "double precision", nullable: true),
                    location_precision = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    group_keys = table.Column<string[]>(type: "text[]", nullable: false),
                    primary_taxonomy_code = table.Column<string>(type: "text", nullable: true),
                    specialty_labels = table.Column<string>(type: "text", nullable: false),
                    enumeration_date = table.Column<DateOnly>(type: "date", nullable: true),
                    registry_last_updated = table.Column<DateOnly>(type: "date", nullable: true),
                    search_vector = table.Column<NpgsqlTsVector>(type: "tsvector", nullable: false, computedColumnSql: "to_tsvector('english', coalesce(full_name, '') || ' ' || coalesce(city, '') || ' ' || coalesce(specialty_labels, ''))", stored: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_providers", x => x.npi);
                });

            migrationBuilder.CreateTable(
                name: "taxonomies",
                columns: table => new
                {
                    code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    group_key = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: true),
                    classification = table.Column<string>(type: "text", nullable: true),
                    specialization = table.Column<string>(type: "text", nullable: true),
                    display_name = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_taxonomies", x => x.code);
                });

            migrationBuilder.CreateTable(
                name: "zip_centroids",
                columns: table => new
                {
                    zip5 = table.Column<string>(type: "character(5)", fixedLength: true, maxLength: 5, nullable: false),
                    lat = table.Column<double>(type: "double precision", nullable: false),
                    lng = table.Column<double>(type: "double precision", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_zip_centroids", x => x.zip5);
                });

            migrationBuilder.CreateTable(
                name: "provider_taxonomies",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    npi = table.Column<string>(type: "character(10)", fixedLength: true, maxLength: 10, nullable: false),
                    code = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    is_primary = table.Column<bool>(type: "boolean", nullable: false),
                    license_number = table.Column<string>(type: "text", nullable: true),
                    license_state = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_provider_taxonomies", x => x.id);
                    table.ForeignKey(
                        name: "fk_provider_taxonomies_providers_npi",
                        column: x => x.npi,
                        principalTable: "providers",
                        principalColumn: "npi",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_provider_taxonomies_code",
                table: "provider_taxonomies",
                column: "code");

            migrationBuilder.CreateIndex(
                name: "ix_provider_taxonomies_npi",
                table: "provider_taxonomies",
                column: "npi");

            migrationBuilder.CreateIndex(
                name: "ix_providers_city",
                table: "providers",
                column: "city");

            migrationBuilder.CreateIndex(
                name: "ix_providers_credentials",
                table: "providers",
                column: "credentials")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "ix_providers_full_name",
                table: "providers",
                column: "full_name")
                .Annotation("Npgsql:IndexMethod", "gin")
                .Annotation("Npgsql:IndexOperators", new[] { "gin_trgm_ops" });

            migrationBuilder.CreateIndex(
                name: "ix_providers_group_keys",
                table: "providers",
                column: "group_keys")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "ix_providers_lat_lng",
                table: "providers",
                columns: new[] { "lat", "lng" });

            migrationBuilder.CreateIndex(
                name: "ix_providers_search_vector",
                table: "providers",
                column: "search_vector")
                .Annotation("Npgsql:IndexMethod", "gin");

            migrationBuilder.CreateIndex(
                name: "ix_providers_zip5",
                table: "providers",
                column: "zip5");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DROP FUNCTION IF EXISTS miles_between(double precision, double precision, double precision, double precision);");

            migrationBuilder.DropTable(
                name: "cities");

            migrationBuilder.DropTable(
                name: "import_runs");

            migrationBuilder.DropTable(
                name: "provider_taxonomies");

            migrationBuilder.DropTable(
                name: "taxonomies");

            migrationBuilder.DropTable(
                name: "zip_centroids");

            migrationBuilder.DropTable(
                name: "providers");
        }
    }
}
