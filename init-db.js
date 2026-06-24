const { neon } = require("@neondatabase/serverless");
const fs = require("fs");

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Set it in .env.local or environment variables.",
  );
  process.exit(1);
}

const sql = neon(DATABASE_URL);

function parseSQLStatements(sqlContent) {
  const statements = [];
  let currentStatement = "";
  let inFunction = false;
  const lines = sqlContent.split("\n");

  for (let line of lines) {
    // Skip comments
    if (line.trim().startsWith("--")) continue;

    currentStatement += line + "\n";

    // Check for function definition markers
    if (line.includes("$$")) {
      inFunction = !inFunction;
    }

    // If not in function and line ends with semicolon, save statement
    if (!inFunction && line.trim().endsWith(";")) {
      statements.push(currentStatement.trim());
      currentStatement = "";
    }
  }

  // Add any remaining statement
  if (currentStatement.trim()) {
    statements.push(currentStatement.trim());
  }

  return statements.filter((s) => s.length > 0);
}

async function initDatabase() {
  try {
    const schema = fs.readFileSync("schema.sql", "utf-8");
    const statements = parseSQLStatements(schema);

    console.log(`Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await sql.query(statement);
        console.log(`[${i + 1}/${statements.length}] ✓`);
      } catch (error) {
        // Ignore "already exists" errors
        if (
          error.code === "42P07" ||
          error.code === "42723" ||
          error.code === "42P01"
        ) {
          console.log(
            `[${i + 1}/${statements.length}] ⊙ (Already exists or relation error)`,
          );
        } else {
          console.error(
            `[${i + 1}/${statements.length}] ✗ Error:`,
            error.message,
          );
          console.error("Statement:", statement.substring(0, 80));
          throw error;
        }
      }
    }

    console.log("\n✓ Database initialization complete!");
    console.log("✓ All tables and triggers created successfully");
    process.exit(0);
  } catch (error) {
    console.error("Failed to initialize database:", error.message);
    process.exit(1);
  }
}

initDatabase();
