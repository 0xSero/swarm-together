use std::path::PathBuf;
use tempfile::TempDir;

#[tokio::test]
async fn test_database_file_creation() {
  let temp_dir = TempDir::new().unwrap();
  let db_path = temp_dir.path().join("integration_test.db");

  assert!(!db_path.exists(), "Database file should not exist initially");

  let db_url = format!("sqlite://{}", db_path.display());
  
  let pool = sqlx::sqlite::SqlitePoolOptions::new()
    .connect_with(
      sqlx::sqlite::SqliteConnectOptions::from_str(&db_url)
        .unwrap()
        .create_if_missing(true)
    )
    .await
    .expect("Failed to create pool");

  assert!(db_path.exists(), "Database file should exist after pool creation");

  let result: (i64,) = sqlx::query_as("SELECT 1")
    .fetch_one(&pool)
    .await
    .unwrap();

  assert_eq!(result.0, 1);
}

use std::str::FromStr;

#[tokio::test]
async fn test_schema_migration() {
  let temp_dir = TempDir::new().unwrap();
  let db_path = temp_dir.path().join("schema_test.db");

  let db_url = format!("sqlite://{}", db_path.display());
  
  let pool = sqlx::sqlite::SqlitePoolOptions::new()
    .connect_with(
      sqlx::sqlite::SqliteConnectOptions::from_str(&db_url)
        .unwrap()
        .create_if_missing(true)
    )
    .await
    .expect("Failed to create pool");

  sqlx::query(
    r#"
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    "#
  )
  .execute(&pool)
  .await
  .expect("Failed to create sessions table");

  let table_count: (i64,) = sqlx::query_as(
    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='sessions'"
  )
  .fetch_one(&pool)
  .await
  .unwrap();

  assert_eq!(table_count.0, 1, "Sessions table should be created");
}
