import pandas as pd
import numpy as np
import joblib
import matplotlib.pyplot as plt
from datasets import load_dataset
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.neighbors import NearestNeighbors
from sklearn.metrics import mean_squared_error, r2_score
from tensorflow.keras.models import Model# type: ignore
from tensorflow.keras.layers import Input, Dense, Dropout, BatchNormalization # type: ignore
from tensorflow.keras.regularizers import l1_l2# type: ignore
from tensorflow.keras.callbacks import EarlyStopping, ReduceLROnPlateau# type: ignore
import logging
import tensorflow as tf  # Import tensorflow

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

def load_data(dataset_name="maharshipandya/spotify-tracks-dataset"):
    """Loads the Spotify tracks dataset."""
    try:
        ds = load_dataset(dataset_name)
        df = pd.DataFrame(ds["train"])
        logging.info(f"Dataset '{dataset_name}' loaded successfully.")
        return df
    except Exception as e:
        logging.error(f"Error loading dataset: {e}")
        raise

def preprocess_data(df, numeric_features):
    """Preprocesses the data: encodes genres, handles missing values, and scales numeric features."""

    df = df.dropna(subset=numeric_features).reset_index(drop=True)

    le = LabelEncoder()
    df['track_genre_encoded'] = le.fit_transform(df['track_genre'])

    for feature in numeric_features[:-1]:
        Q1 = df[feature].quantile(0.25)
        Q3 = df[feature].quantile(0.75)
        IQR = Q3 - Q1
        df = df[~((df[feature] < (Q1 - 1.5 * IQR)) | (df[feature] > (Q3 + 1.5 * IQR)))]

    X = df[numeric_features].values
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    logging.info("Data preprocessing completed.")
    return X_scaled, scaler

def create_autoencoder(input_dim, architecture, l1_reg=1e-5, l2_reg=1e-4, dropout_rate=0.2):
    """
    Creates the autoencoder model.

    Args:
        input_dim (int): Dimensionality of the input data.
        architecture (list): List defining the autoencoder architecture.
                            Each element is a tuple (units, activation).
        l1_reg (float): L1 regularization strength.
        l2_reg (float): L2 regularization strength.
        dropout_rate (float): Dropout rate.

    Returns:
        tuple: (autoencoder model, encoder model)
    """

    input_layer = Input(shape=(input_dim,))
    x = input_layer

    # Encoder
    for units, activation in architecture[:-1]:  # Exclude the last layer (latent space)
        x = Dense(units, activation=activation, kernel_regularizer=l1_l2(l1_reg, l2_reg))(x)
        x = BatchNormalization()(x)
        x = Dropout(dropout_rate)(x)

    # Latent space
    latent_dim, latent_activation = architecture[-1]
    encoded = Dense(latent_dim, activation=latent_activation, kernel_regularizer=l1_l2(l1_reg, l2_reg))(x)
    encoder = Model(input_layer, encoded)  # Define encoder model

    # Decoder
    x = encoded
    for units, activation in reversed(architecture[:-1]):
        x = Dense(units, activation=activation)(x)
        x = BatchNormalization()(x)
        x = Dropout(dropout_rate)(x)

    decoded = Dense(input_dim, activation='linear')(x)  # Output layer
    autoencoder = Model(input_layer, decoded)

    logging.info("Autoencoder model created.")
    return autoencoder, encoder

def train_model(autoencoder, X_scaled, epochs, batch_size, validation_split, patience=5, reduce_lr_patience=3):
    """Trains the autoencoder model."""

    autoencoder.compile(optimizer='adam', loss='mse')

    callbacks = [
        EarlyStopping(patience=patience, restore_best_weights=True),
        ReduceLROnPlateau(patience=reduce_lr_patience)
    ]

    history = autoencoder.fit(
        X_scaled, X_scaled,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=validation_split,
        callbacks=callbacks,
        verbose=0 # Suppress output during training
    )

    logging.info("Autoencoder training completed.")
    return history

def evaluate_model(autoencoder, X_scaled, output_file="model_metrics.txt"):
    """Evaluates the autoencoder model and saves the metrics."""

    predictions = autoencoder.predict(X_scaled, verbose=0) # Suppress output during prediction
    mse = mean_squared_error(X_scaled, predictions)
    r2 = r2_score(X_scaled, predictions)

    logging.info(f"Model Evaluation Metrics: MSE = {mse:.4f}, R² = {r2:.4f}")

    with open(output_file, "w") as f:
        f.write(f"Mean Squared Error: {mse:.4f}\n")
        f.write(f"R² Score: {r2:.4f}\n")

def plot_training_history(history, output_file="training_history.png"):
    """Plots the training history (loss vs. epochs)."""

    plt.figure(figsize=(12, 6))
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Autoencoder Training History')
    plt.xlabel('Epoch')
    plt.ylabel('Mean Squared Error')
    plt.legend()
    plt.grid(True)
    plt.savefig(output_file)
    plt.close()
    logging.info(f"Training history plot saved to '{output_file}'")

def create_knn_model(latent_features, n_neighbors=5, metric='cosine', output_file="knn_model.pkl"):
    """Creates and saves the KNN model."""
    knn = NearestNeighbors(n_neighbors=n_neighbors, metric=metric)
    knn.fit(latent_features)
    joblib.dump(knn, output_file)
    logging.info(f"KNN model saved to '{output_file}'")
    return knn

def save_artifacts(df, X_scaled, latent_features,  df_file="df.pkl", x_file="X_scaled.npy", latent_file="latent_features.npy"):
    """Saves data artifacts."""

    df.to_pickle(df_file)
    np.save(x_file, X_scaled)
    np.save(latent_file, latent_features)
    logging.info("Data artifacts saved.")

def main(epochs=50, batch_size=128, validation_split=0.2, latent_dim=8):
    """Main function to orchestrate the autoencoder training and KNN model creation."""

    logging.info("Starting autoencoder training and KNN model creation.")

    df = load_data()
    numeric_features = [
        'danceability', 'energy', 'loudness', 'speechiness',
        'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo',
        'track_genre_encoded'
    ]
    X_scaled, scaler = preprocess_data(df.copy(), numeric_features)  # Pass a copy to avoid modifying original df
    input_dim = X_scaled.shape[1]

    # Flexible architecture definition
    architecture = [(64, 'relu'), (32, 'relu'), (latent_dim, 'relu')]  # Example: 3 layers

    autoencoder, encoder = create_autoencoder(input_dim, architecture)
    history = train_model(autoencoder, X_scaled, epochs, batch_size, validation_split)
    plot_training_history(history)
    evaluate_model(autoencoder, X_scaled)

    latent_features = encoder.predict(X_scaled, verbose=0) # Suppress output during prediction
    create_knn_model(latent_features)
    save_artifacts(df, X_scaled, latent_features)

    logging.info("Autoencoder training and KNN model creation completed successfully.")

if __name__ == "__main__":
    # You can adjust these parameters
    main(epochs=50, batch_size=128, validation_split=0.2, latent_dim=8)