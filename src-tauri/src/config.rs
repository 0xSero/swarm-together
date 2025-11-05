use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct AppConfig {
  pub app_name: String,
  pub version: String,
  pub db_pool_size: u32,
  pub log_level: String,
}

impl Default for AppConfig {
  fn default() -> Self {
    Self {
      app_name: "Agent Manager".to_string(),
      version: "0.0.1".to_string(),
      db_pool_size: 5,
      log_level: "info".to_string(),
    }
  }
}

impl AppConfig {
  pub fn load(path: &Path) -> crate::error::AppResult<Self> {
    if path.exists() {
      let content = std::fs::read_to_string(path)
        .map_err(|e| crate::error::AppError::Config(e.to_string()))?;
      serde_json::from_str(&content)
        .map_err(|e| crate::error::AppError::Config(e.to_string()))
    } else {
      Ok(Self::default())
    }
  }

  pub fn save(&self, path: &Path) -> crate::error::AppResult<()> {
    let content = serde_json::to_string_pretty(self)
      .map_err(|e| crate::error::AppError::Config(e.to_string()))?;
    std::fs::write(path, content)
      .map_err(|e| crate::error::AppError::Config(e.to_string()))
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;
  use tempfile::TempDir;

  #[test]
  fn test_default_config() {
    let config = AppConfig::default();
    assert_eq!(config.app_name, "Agent Manager");
    assert_eq!(config.version, "0.0.1");
  }

  #[test]
  fn test_config_save_and_load() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.json");

    let original_config = AppConfig::default();
    original_config.save(&config_path).unwrap();

    let loaded_config = AppConfig::load(&config_path).unwrap();
    assert_eq!(original_config.app_name, loaded_config.app_name);
  }
}
