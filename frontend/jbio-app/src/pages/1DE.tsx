import OneDESim from '../components/1DE/1DESim';

function OneDE() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "2rem",
        padding: "0 2rem",
      }}
    >
      <div
        style={{
          flex: "1 1 30%",
        }}
      >
        <OneDESim />
      </div>
    </div>
  );
}

export default OneDE;
