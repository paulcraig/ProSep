import React, { useEffect, useState } from "react";
import "./ProteolyticDigestion.css";
import { API_URL } from "../config";
import graph from  "../assets/proteinGraph.png"
import emptyGraph from "../assets/EmptyProteinGraph.png"
import { FormControl, Grid, MenuItem, Select } from "@mui/material";

const ProteolyticDigestion: React.FC = () => {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [proteins, setProteins] = useState([]);
  const [currentSeq, setSequence] = useState("");
  const [aminoAcids, setAminoAcids] = useState([]);
  const [graphKey, setGraphKey] = useState(0);
  

  const PROTEASES = new Map<string, string>();
  PROTEASES.set("PreScission", "Q");
  PROTEASES.set("Thrombin", "R");
  PROTEASES.set("Enterokinase", "K");
 PROTEASES.set("Chymotrypsin", "F");
 PROTEASES.set("trypsin", "K");
 PROTEASES.set("pepsin", "R");

  const changeSelectedProtease = async (val: unknown) => {
    setUploading(true);
    setMessage("Processing...");

    try {
      const payload = {
        sequence: currentSeq,
        aminoAcid: PROTEASES.get(val as string),
      };
      console.log(JSON.stringify(payload));
      const response = await fetch(
        `${API_URL}/proteolytic_digestion/seperateProtein`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to process sequence`);
      }

      const proteins = await response.json();
      console.log("Proteins from server:", proteins);
      setAminoAcids(proteins);

      setMessage("Processing successful!");
    } catch (error) {
      console.error("Error processing sequence:", error);
      setMessage("Error processing sequence.");
    } finally {
      setUploading(false);
     setGraphKey(prev => prev + 1);

  setGraphKey(prev => prev + 1);   // <-- forces graph to reload

    }
  };
  const displaySequence = async (protein: string) => {
    setSequence(protein);
  };
  const isSelected = () => {
    return !(currentSeq == "");
  };
  const hasProteins = () => {
    return !(proteins.length == 0);
  }
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setMessage("Uploading...");

    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(
          `${API_URL}/proteolytic_digestion/parse_fasta`,
          {
            method: "POST",
            body: formData,
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        const proteins = await response.json();
        console.log("Uploaded proteins:", proteins);
        setProteins(proteins);
      }

      setMessage("Upload successful!");
    } catch (error) {
      console.error("Error uploading file:", error);
      setMessage("Error uploading file.");
    } finally {
      setUploading(false);
      
    }
  

  };


  return (
    
    <div className="proteolytic-page">
      <label
        className="twoDE-button icon"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          cursor: uploading ? "not-allowed" : "pointer",
          opacity: uploading ? 0.6 : 1,
        }}
      >
        Upload FASTA
        <input
          type="file"
          accept=".fasta,.fa,.faa,.FAA"
          multiple
          onChange={handleFileChange}
          style={{ display: "none" }}
        />
      </label>

      {message && <p style={{ marginTop: "10px" }}>{message}</p>}
      <Grid container columns={3}>
        <Grid className="proteinlist" size={1}>
          <Grid container columns={1}>
            <Grid size={1}>
            <label htmlFor="">Select Specific Protein</label>
            <FormControl className="word">
              <Select
                onChange={(e) => displaySequence((e.target as any).value as string)}
               
              >
                {proteins.map((protein) => (
                  <MenuItem key={protein["name"]} value={protein["sequence"]}>
                    {protein["name"]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            </Grid>
          
          </Grid>
        </Grid>
        <Grid  size={1}>
          {hasProteins() ? <img className="graph" src={`${graph}?v=${graphKey}`}></img> :  <img className="graph" src={`${emptyGraph}`}></img>}
          
        </Grid>
        <Grid size={1}>
          <Grid container>
            <Grid size={12}>
              <div className="word">SELECTED PROTEIN</div>
              <div className="selectedProtein">
                {isSelected() ? currentSeq : "No protein selected"}
              </div>
            </Grid>
            <Grid size={12}>
              <div className="word">Select a protease</div>
              <FormControl className="word">
                <Select
                  onChange={(e) => {
                    changeSelectedProtease(e.target.value);
                  }}
                >
                  
                  {Array.from(PROTEASES.entries()).map(([key, val]) => (
                    <MenuItem key={key} value={key}>
                      {key}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid size={12}>
              {aminoAcids.map((value) => (
                <div className="selectedProtein">{value}</div>
              ))}
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </div>
  );
};

export default ProteolyticDigestion;
