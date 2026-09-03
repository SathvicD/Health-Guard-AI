from app.core.database import SessionLocal
from app.ml.model_training import train_ml_service


def main():

    db = SessionLocal()

    try:
        # Train the ML model
        ml_service = train_ml_service()

        # Analyze Hospital B doctor
        user_id = 3

        result = ml_service.analyze_user(
            db=db,
            user_id=user_id,
        )

        print("\nHealthGuard AI - User Risk Analysis")
        print("=" * 55)

        print(f"User ID: {user_id}")

        if result["status"] == "INSUFFICIENT_DATA":

            print("\nStatus: INSUFFICIENT_DATA")
            print(result["message"])

            return

        print("\nBehavior Features")
        print("-" * 55)

        for feature, value in result["features"].items():
            print(f"{feature}: {value}")

        print("\nML Analysis")
        print("-" * 55)

        print(
            f"Prediction: "
            f"{result['prediction']}"
        )

        print(
            f"Anomaly Score: "
            f"{result['anomaly_score']}"
        )

        print(
            f"Risk Score: "
            f"{result['risk_score']}"
        )

        print(
            f"Risk Level: "
            f"{result['risk_level']}"
        )

        print(
            f"Security Action: "
            f"{result['security_action']}"
        )

    finally:
        db.close()


if __name__ == "__main__":
    main()