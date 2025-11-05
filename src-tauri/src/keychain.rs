use crate::error::{AppError, AppResult};

pub struct KeychainManager {
  service_name: String,
}

impl KeychainManager {
  pub fn new(service_name: impl Into<String>) -> Self {
    Self {
      service_name: service_name.into(),
    }
  }

  pub fn store_secret(&self, key: &str, value: &str) -> AppResult<()> {
    keyring::Entry::new(&self.service_name, key)
      .map_err(|e| AppError::Keychain(e.to_string()))?
      .set_password(value)
      .map_err(|e| AppError::Keychain(e.to_string()))
  }

  pub fn retrieve_secret(&self, key: &str) -> AppResult<String> {
    keyring::Entry::new(&self.service_name, key)
      .map_err(|e| AppError::Keychain(e.to_string()))?
      .get_password()
      .map_err(|e| AppError::Keychain(e.to_string()))
  }

  pub fn delete_secret(&self, key: &str) -> AppResult<()> {
    keyring::Entry::new(&self.service_name, key)
      .map_err(|e| AppError::Keychain(e.to_string()))?
      .delete_password()
      .map_err(|e| AppError::Keychain(e.to_string()))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_keychain_manager_creation() {
    let manager = KeychainManager::new("test-service");
    assert_eq!(manager.service_name, "test-service");
  }
}
