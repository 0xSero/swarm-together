use crate::error::{AppError, AppResult};
use sqlx::sqlite::{SqlitePool, SqlitePoolOptions, SqliteConnectOptions};
use std::path::Path;
use std::str::FromStr;
use tracing::info;

pub struct Database {
  pool: SqlitePool,
}

impl Database {
  pub async fn init(db_path: &Path) -> AppResult<Self> {
    let db_url = format!("sqlite://{}", db_path.display());
    
    let connect_options = SqliteConnectOptions::from_str(&db_url)
      .map_err(|e| AppError::Database(e.to_string()))?
      .create_if_missing(true);

    let pool = SqlitePoolOptions::new()
      .max_connections(5)
      .connect_with(connect_options)
      .await
      .map_err(|e| AppError::Database(e.to_string()))?;

    let start = std::time::Instant::now();
    
    info!("Running database migrations");
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
    .map_err(|e| AppError::Database(format!("Failed to create sessions table: {}", e)))?;

    sqlx::query(
      r#"
      CREATE TABLE IF NOT EXISTS panes (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );
      "#
    )
    .execute(&pool)
    .await
    .map_err(|e| AppError::Database(format!("Failed to create panes table: {}", e)))?;

    let elapsed = start.elapsed();
    info!("Database migrations completed in {:?}", elapsed);

    Ok(Database { pool })
  }

  pub fn pool(&self) -> &SqlitePool {
    &self.pool
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use tempfile::TempDir;

  #[tokio::test]
  async fn test_database_init() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let db = Database::init(&db_path).await.unwrap();
    assert!(db_path.exists());

    let pool = db.pool();
    let result: (i64,) = sqlx::query_as("SELECT 1")
      .fetch_one(pool)
      .await
      .unwrap();
    assert_eq!(result.0, 1);
  }

  #[tokio::test]
  async fn test_sessions_table_created() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::init(&db_path).await.unwrap();
    
    let db2 = Database::init(&db_path).await.unwrap();
    let pool = db2.pool();

    let table_exists: (i64,) = sqlx::query_as(
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='sessions'"
    )
    .fetch_one(pool)
    .await
    .unwrap();

    assert_eq!(table_exists.0, 1);
  }

  #[tokio::test]
  async fn test_panes_table_created() {
    let temp_dir = TempDir::new().unwrap();
    let db_path = temp_dir.path().join("test.db");

    let _db = Database::init(&db_path).await.unwrap();
    
    let db2 = Database::init(&db_path).await.unwrap();
    let pool = db2.pool();

    let table_exists: (i64,) = sqlx::query_as(
      "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='panes'"
    )
    .fetch_one(pool)
    .await
    .unwrap();

    assert_eq!(table_exists.0, 1);
  }
}
