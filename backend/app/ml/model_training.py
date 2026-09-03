from app.ml.generate_dataset import create_dataset
from app.services.ml_service import MLRiskService


def train_ml_service():
    """
    Generate development training data and
    train the HealthGuard AI anomaly detector.
    """

    training_data = create_dataset(
        normal_samples=500,
        suspicious_samples=100,
    )

    ml_service = MLRiskService()

    ml_service.train(training_data)

    return ml_service


if __name__ == "__main__":

    service = train_ml_service()

    print(
        "\nHealthGuard AI ML model trained successfully."
    )

    print(
        "Contamination: 0.15"
    )

    print(
        "Training samples: 600"
    )