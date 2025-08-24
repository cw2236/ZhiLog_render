import React, {
  useCallback,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import ReactFlow, {
  addEdge,
  Controls,
  Background,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import dagre from "dagre";
import styles from "./ReactFlow.module.css";
import { ZhilogChat } from "../../components/ZhilogChat/ZhilogChat";
import { Navigation } from "../../components/Navigation/Navigation";

// mock API
const mockApi = async (prompt) =>
  new Promise((resolve) =>
    setTimeout(() => resolve(`这是对 "${prompt}" 的回复:`), 500)
  );

// Dagre 图实例
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const STORAGE_KEY = "branching_flow_data_v3";

// reply node
const CustomReplyNode = ({ id, data, nodes, setNodes, setEdges }) => {
  const hasChild = nodes.some((n) => n.data.parent === id);

  const handleBranch = () => {
    const newId = `input-${Date.now()}`;
    const newNode = {
      id: newId,
      type: "customInput",
      data: { label: "继续提问…", value: "", parent: id },
      position: { x: 0, y: 0 },
    };
    const edge = {
      id: `e-${id}-${newId}`,
      source: id,
      target: newId,
      type: "smoothstep",
      sourceHandle: "source",
      targetHandle: "target",
      style: { strokeDasharray: "4 4" },
    };
    setNodes((nds) => [...nds, newNode]);
    setEdges((eds) => [...eds, edge]);
  };

  return (
    <div className={styles.replyNode}>
      <Handle type="target" position={Position.Top} id="target" />
      <div className={styles.typewriterText}>{data.text}</div>
      <div className={styles.replyPlus} onClick={handleBranch}>
        +
      </div>
      <Handle
        type="source"
        position={Position.Bottom}
        id="source"
        style={{ visibility: hasChild ? "visible" : "hidden" }}
      />
    </div>
  );
};

const ChatFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [rfInstance, setRfInstance] = useState(null);
  const didFitRef = useRef(false);

  const nodesRef = useRef(nodes);
  const setNodesRef = useRef(setNodes);
  const setEdgesRef = useRef(setEdges);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);
  useEffect(() => {
    setNodesRef.current = setNodes;
  }, [setNodes]);
  useEffect(() => {
    setEdgesRef.current = setEdges;
  }, [setEdges]);

  // 恢复数据
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const { nodes: sn, edges: se } = JSON.parse(saved);
        if (sn?.length) {
          setNodes(sn);
          setEdges(se);
        }
      } catch {}
    }
  }, []);

  // 保存数据
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  }, [nodes, edges]);

  // 动态 Dagre 布局
  const getDagreLayout = useCallback(
    (nodesArr, edgesArr) => {
      // 1. 读取当前 zoom
      const zoom =
        rfInstance?.getZoom?.() ??
        Number(
          getComputedStyle(
            document.querySelector(".react-flow__viewport")
          ).transform.match(/matrix\(([^,]+),/)[1]
        );

      // 2. 测量每个节点真实尺寸
      const measured = nodesArr.map((n) => {
        const el = document.querySelector(
          `.react-flow__node[data-id="${n.id}"]`
        );
        if (el) {
          const { width, height } = el.getBoundingClientRect();
          return { ...n, width: width / zoom, height: height / zoom };
        }
        return n;
      });

      // 3. 构建 Dagre 图并布局
      dagreGraph.setGraph({ rankdir: "TB", ranksep: 80, nodesep: 50 });
      measured.forEach((n) =>
        dagreGraph.setNode(n.id, { width: n.width, height: n.height })
      );
      edgesArr.forEach((e) => dagreGraph.setEdge(e.source, e.target));
      dagre.layout(dagreGraph);

      // 4. 返回新的坐标
      return measured.map((n) => {
        const pos = dagreGraph.node(n.id);
        return pos
          ? {
              ...n,
              position: { x: pos.x - n.width / 2, y: pos.y - n.height / 2 },
            }
          : n;
      });
    },
    [rfInstance]
  );

  // 重新规划排列 dagre
  useEffect(() => {
    if (edges.length && rfInstance) {
      setTimeout(() => {
        setNodes((nds) => getDagreLayout(nds, edges));
      }, 0);
    }
  }, [edges.length, rfInstance, getDagreLayout]);

  // fitView
  useEffect(() => {
    if (rfInstance && nodes.length && !didFitRef.current) {
      setTimeout(() => {
        rfInstance.fitView({ padding: 0.2, minZoom: 0.3, maxZoom: 1.5 });
        didFitRef.current = true;
      }, 50);
    }
  }, [rfInstance, nodes.length]);

  // input node
  const CustomInputNode = useCallback(({ id, data }) => {
    const [val, setVal] = useState(data.value || "");
    const submitting = useRef(false);

    const handleSubmit = async () => {
      if (!val.trim() || submitting.current) return;
      submitting.current = true;
      setNodes((nds) =>
        nds.map((n) =>
          n.id === id ? { ...n, data: { ...n.data, value: val } } : n
        )
      );
      let reply = "";
      try {
        reply = await mockApi(val);
      } catch {
        reply = "调用失败，请重试";
      }

      const rId = `reply-${Date.now()}`;
      const replyNode = {
        id: rId,
        type: "customReply",
        data: { text: reply },
        position: { x: 0, y: 0 },
      };
      const edge = {
        id: `e-${id}-${rId}`,
        source: id,
        target: rId,
        type: "smoothstep",
        sourceHandle: "source",
        targetHandle: "target",
        style: { strokeDasharray: "4 4" },
      };
      setNodes((nds) => [...nds, replyNode]);
      setEdges((eds) => [...eds, edge]);
      submitting.current = false;
    };

    const hasChild = nodesRef.current.some((n) => n.data.parent === id);
    console.log(hasChild);

    return (
      <div className={styles.inputNode}>
        {data.parent ? (
          <Handle type="target" position={Position.Top} id="target" />
        ) : null}

        <div className={styles.inputHeader}>
          <div className={styles.avatar}>
            <img alt="logo" src="assets/image3.png" className={styles.avatar} />
          </div>
          <div className={styles.messageHeader}>
            <span className={styles.username}>Zuo</span>
            <span className={styles.timestamp}>
              {new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
        <div className={styles.inputRow}>
          <textarea
            className={styles.inputField}
            value={val}
            placeholder="输入问题"
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          />
        </div>
        <div className={styles.tips}>
          {data.parent ? "User Question" : "Initial Prompt"}
        </div>
        <Handle
          type="source"
          position={Position.Bottom}
          id="source"
          style={{ visibility: val.trim() ? "visible" : "hidden" }}
        />
      </div>
    );
  }, []);

  const stableCustomReply = useCallback(
    (props) => (
      <CustomReplyNode
        {...props}
        nodes={nodesRef.current}
        setNodes={setNodesRef.current}
        setEdges={setEdgesRef.current}
      />
    ),
    []
  );

  // chat tree
  const nodeTypes = useMemo(
    () => ({ customInput: CustomInputNode, customReply: stableCustomReply }),
    [CustomInputNode, stableCustomReply]
  );

  // 连接线
  const onConnect = useCallback(
    (params) =>
      setEdges((eds) => addEdge({ ...params, type: "smoothstep" }, eds)),
    []
  );

  const createNode = useCallback(() => {
    if (!nodesRef.current.length) {
      const rootId = `input-${Date.now()}`;
      setNodesRef.current([
        {
          id: rootId,
          type: "customInput",
          data: { label: "输入你的问题…", value: "", parent: null },
          position: { x: 200, y: 100 },
        },
      ]);
    }
  }, []);

  return (
    <div id={styles.ReactFlow}>
      <div id={styles.nav}>
        <Navigation />
      </div>
      <main>
        <div className={styles.canvasWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={setRfInstance}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodesDraggable={false}
            nodesConnectable
            fitView
            connectionLineType="smoothstep"
            connectionLineStyle={{ strokeWidth: 2, strokeDasharray: "4 4" }}
            className={styles.reactFlow}
          >
            <Background gap={16} />
            <Controls />
          </ReactFlow>
          <div className={styles.canvas_nav}>
            <div />
            <div onClick={createNode}>
              {" "}
              <svg
                width="44"
                height="30"
                viewBox="0 0 44 30"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M22.5625 14.7708H22.4342C21.9071 12.415 19.8033 10.6458 17.2917 10.6458H15.6875V10.0591C16.485 9.77498 17.0625 9.01873 17.0625 8.12498C17.0625 6.98831 16.1367 6.06248 15 6.06248C13.8633 6.06248 12.9375 6.98831 12.9375 8.12498C12.9375 9.01873 13.515 9.77498 14.3125 10.0591V10.6458H12.7083C10.1967 10.6458 8.09292 12.415 7.56583 14.7708H7.4375C6.68125 14.7708 6.0625 15.3896 6.0625 16.1458V17.5208C6.0625 18.2771 6.68125 18.8958 7.4375 18.8958H7.68958C8.23042 20.5825 9.59625 21.8933 11.3104 22.37C11.1821 22.6404 11.1042 22.9337 11.1042 23.25C11.1042 23.6304 11.4113 23.9375 11.7917 23.9375H18.2083C18.5887 23.9375 18.8958 23.6304 18.8958 23.25C18.8958 22.9337 18.8179 22.6358 18.6896 22.37C20.4038 21.8979 21.7696 20.5825 22.3104 18.8958H22.5625C23.3188 18.8958 23.9375 18.2771 23.9375 17.5208V16.1458C23.9375 15.3896 23.3188 14.7708 22.5625 14.7708ZM15 7.43748C15.3804 7.43748 15.6875 7.74456 15.6875 8.12498C15.6875 8.5054 15.3804 8.81248 15 8.81248C14.6196 8.81248 14.3125 8.5054 14.3125 8.12498C14.3125 7.74456 14.6196 7.43748 15 7.43748ZM17.2917 21.1875H12.7083C10.5588 21.1875 8.8125 19.4412 8.8125 17.2916V15.9166C8.8125 13.7671 10.5588 12.0208 12.7083 12.0208H17.2917C19.4412 12.0208 21.1875 13.7671 21.1875 15.9166V17.2916C21.1875 19.4412 19.4412 21.1875 17.2917 21.1875Z"
                  fill="white"
                />
                <path
                  d="M12.4792 13.8541C11.7229 13.8541 11.1042 14.4729 11.1042 15.2291V16.6041C11.1042 17.3604 11.7229 17.9791 12.4792 17.9791C13.2354 17.9791 13.8542 17.3604 13.8542 16.6041V15.2291C13.8542 14.4729 13.2354 13.8541 12.4792 13.8541Z"
                  fill="white"
                />
                <path
                  d="M17.5208 13.8541C16.7646 13.8541 16.1458 14.4729 16.1458 15.2291V16.6041C16.1458 17.3604 16.7646 17.9791 17.5208 17.9791C18.2771 17.9791 18.8958 17.3604 18.8958 16.6041V15.2291C18.8958 14.4729 18.2771 13.8541 17.5208 13.8541Z"
                  fill="white"
                />
                <path
                  d="M10.2013 7.40081L11.5763 7.85915C11.6496 7.88206 11.7229 7.89581 11.7917 7.89581C12.0804 7.89581 12.3463 7.71248 12.4425 7.42373C12.5617 7.06165 12.3692 6.67206 12.0071 6.5529L10.6321 6.09456C10.2746 5.9754 9.885 6.1679 9.76125 6.52998C9.6375 6.89206 9.83458 7.28165 10.1967 7.40081H10.2013Z"
                  fill="white"
                />
                <path
                  d="M10.4167 10.1875C10.49 10.1875 10.5633 10.1783 10.6321 10.1508L12.0071 9.69248C12.3692 9.57331 12.5617 9.18373 12.4425 8.82165C12.3233 8.45956 11.9338 8.26706 11.5717 8.38623L10.1967 8.84456C9.83458 8.96373 9.64208 9.35331 9.76125 9.7154C9.8575 10.0041 10.1233 10.1875 10.4121 10.1875H10.4167Z"
                  fill="white"
                />
                <path
                  d="M18.2083 7.89581C18.2817 7.89581 18.355 7.88665 18.4237 7.85915L19.7988 7.40081C20.1608 7.28165 20.3533 6.89206 20.2342 6.52998C20.115 6.1679 19.7254 5.9754 19.3633 6.09456L17.9883 6.5529C17.6263 6.67206 17.4338 7.06165 17.5529 7.42373C17.6492 7.71248 17.915 7.89581 18.2038 7.89581H18.2083Z"
                  fill="white"
                />
                <path
                  d="M17.9929 9.69248L19.3679 10.1508C19.4412 10.1737 19.5146 10.1875 19.5833 10.1875C19.8721 10.1875 20.1379 10.0041 20.2342 9.7154C20.3533 9.35331 20.1608 8.96373 19.7988 8.84456L18.4237 8.38623C18.0662 8.26706 17.6721 8.45956 17.5529 8.82165C17.4338 9.18373 17.6263 9.57331 17.9883 9.69248H17.9929Z"
                  fill="white"
                />
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M35.1459 14.1459C35.1924 14.0994 35.2475 14.0624 35.3083 14.0372C35.369 14.012 35.4341 13.999 35.4999 13.999C35.5657 13.999 35.6308 14.012 35.6916 14.0372C35.7523 14.0624 35.8075 14.0994 35.8539 14.1459L37.4999 15.7929L39.1459 14.1459C39.2398 14.052 39.3671 13.9993 39.4999 13.9993C39.6327 13.9993 39.76 14.052 39.8539 14.1459C39.9478 14.2398 40.0005 14.3671 40.0005 14.4999C40.0005 14.6327 39.9478 14.76 39.8539 14.8539L37.8539 16.8539C37.8075 16.9005 37.7523 16.9374 37.6916 16.9626C37.6308 16.9878 37.5657 17.0008 37.4999 17.0008C37.4341 17.0008 37.369 16.9878 37.3083 16.9626C37.2475 16.9374 37.1924 16.9005 37.1459 16.8539L35.1459 14.8539C35.0994 14.8075 35.0624 14.7523 35.0372 14.6916C35.012 14.6308 34.999 14.5657 34.999 14.4999C34.999 14.4341 35.012 14.369 35.0372 14.3083C35.0624 14.2475 35.0994 14.1924 35.1459 14.1459Z"
                  fill="white"
                />
              </svg>
            </div>
            <div />
          </div>
        </div>
        <ZhilogChat />
      </main>
    </div>
  );
};

const ChatFlowCanvas = () => (
  <ReactFlowProvider>
    <ChatFlow />
  </ReactFlowProvider>
);

export default ChatFlowCanvas;
