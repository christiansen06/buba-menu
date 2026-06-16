function StepProgress({ current, total }) {
    return (
        <div className="step-progress">
            <div className="step-progress-track">
                <div
                    className="step-progress-fill"
                    style={{ width: `${(current / total) * 100}%` }}
                />
            </div>
            <span className="step-progress-label">Paso {current} de {total}</span>
        </div>
    );
}

export default StepProgress;