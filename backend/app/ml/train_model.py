from sklearn.metrics import classification_report
from sklearn.model_selection import train_test_split

from app.ml.anomaly_detector import AccessAnomalyDetector
from app.ml.generate_dataset import create_dataset


FEATURE_COLUMNS = [
    "total_accesses",
    "allowed_accesses",
    "denied_accesses",
    "unique_patients",
    "unique_documents",
    "view_count",
    "average_access_hour",
    "night_access_count",
]


def evaluate_model(contamination, X_train, X_test, y_test):

    detector = AccessAnomalyDetector(
        contamination=contamination,
        random_state=42,
    )

    detector.train(X_train.values)

    predictions = detector.model.predict(
        X_test.values
    )

    report = classification_report(
        y_test,
        predictions,
        output_dict=True,
        zero_division=0,
    )

    suspicious = report["-1"]

    return {
        "contamination": contamination,
        "precision": suspicious["precision"],
        "recall": suspicious["recall"],
        "f1": suspicious["f1-score"],
    }


def main():

    print("\nHealthGuard AI - Isolation Forest Tuning")
    print("=" * 60)

    # Generate dataset
    df = create_dataset(
        normal_samples=500,
        suspicious_samples=100,
    )

    X = df[FEATURE_COLUMNS]

    y = df["behavior"].map(
        {
            "normal": 1,
            "suspicious": -1,
        }
    )

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=0.20,
        random_state=42,
        stratify=y,
    )

    contamination_values = [
        0.05,
        0.10,
        0.15,
        0.20,
    ]

    results = []

    for contamination in contamination_values:

        result = evaluate_model(
            contamination,
            X_train,
            X_test,
            y_test,
        )

        results.append(result)

    print("\nModel Comparison")
    print("=" * 60)

    print(
        f"{'Contamination':<18}"
        f"{'Precision':<15}"
        f"{'Recall':<15}"
        f"{'F1':<15}"
    )

    print("-" * 60)

    for result in results:

        print(
            f"{result['contamination']:<18.2f}"
            f"{result['precision']:<15.2f}"
            f"{result['recall']:<15.2f}"
            f"{result['f1']:<15.2f}"
        )

    # Select model with highest suspicious F1
    best_result = max(
        results,
        key=lambda x: x["f1"],
    )

    print("\nBest Configuration")
    print("=" * 60)

    print(
        f"Contamination: "
        f"{best_result['contamination']:.2f}"
    )

    print(
        f"Precision: "
        f"{best_result['precision']:.2f}"
    )

    print(
        f"Recall: "
        f"{best_result['recall']:.2f}"
    )

    print(
        f"F1-score: "
        f"{best_result['f1']:.2f}"
    )


if __name__ == "__main__":
    main()