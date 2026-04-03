  const fetchTemplates = async () => {
    setModalLoading(true);
    console.log("Fetching templates from:", server.MTC_SDS_TEMPLATES);
    try {
      const res = await axios.get(server.MTC_SDS_TEMPLATES);
      console.log("Templates response data:", res.data);
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (e) { 
        console.error("Fetch Templates Error details:", e.response || e);
        setTemplates([]); 
    } finally { setModalLoading(false); }
  };
