use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
  #[error("Database error: {0}")]
  Database(String),

  #[error("Config error: {0}")]
  Config(String),

  #[error("Keychain error: {0}")]
  Keychain(String),

  #[error("IO error: {0}")]
  Io(#[from] std::io::Error),

  #[error("Unknown error: {0}")]
  Unknown(String),
}

pub type AppResult<T> = Result<T, AppError>;
