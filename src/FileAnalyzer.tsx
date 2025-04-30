import { useState, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import annotationPlugin from "chartjs-plugin-annotation";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

export default function FileAnalyzer() {
  const [activeTab, setActiveTab] = useState("video");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [timeData, setTimeData] = useState<number[]>([]);
  const [forceData1, setForceData1] = useState<number[]>([]);
  const [forceData2, setForceData2] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [totalFrames, setTotalFrames] = useState(0);
  const [currentFrame, setCurrentFrame] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setVideoFile(file);
      const url = URL.createObjectURL(file);
      if (videoRef.current) {
        videoRef.current.src = url;
        videoRef.current.onloadedmetadata = () => {
          const frames = Math.floor(videoRef.current!.duration * 30);
          setTotalFrames(frames);
        };
      }
    }
  };

  const handleCSVUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFile(file);
      const text = await file.text();
      const rows = text.split("\n").slice(1); // Skip header
      const times: number[] = [];
      const forces1: number[] = [];
      const forces2: number[] = [];
      
      rows.forEach(row => {
        const columns = row.split(",");
        if (columns.length >= 4) {
          const time = parseFloat(columns[0]) || 0;
          times.push(time);
          forces1.push(parseFloat(columns[3]) || 0);
          forces2.push(parseFloat(columns[12]) || 0);
        }
      });
      
      setTimeData(times);
      setForceData1(forces1);
      setForceData2(forces2);
      setCurrentTime(times[0] || 0);
    }
  };

  const moveFrame = (direction: number) => {
    if (videoRef.current) {
      const newFrame = currentFrame + direction;
      if (newFrame >= 0 && newFrame < totalFrames) {
        setCurrentFrame(newFrame);
        videoRef.current.currentTime = newFrame / 30;
      }
    }
  };

  const trimAndExportVideo = async () => {
    if (!videoRef.current) return;
    
    setIsExporting(true);
    try {
      const mediaRecorder = new MediaRecorder(videoRef.current.captureStream(), {
        mimeType: 'video/webm'
      });
      
      const chunks: Blob[] = [];
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'trimmed-video.mp4';
        a.click();
        URL.revokeObjectURL(url);
      };
      
      mediaRecorder.start();
      videoRef.current.play();
      videoRef.current.onended = () => {
        mediaRecorder.stop();
        setIsExporting(false);
      };
    } catch (error) {
      console.error('Error exporting video:', error);
      setIsExporting(false);
    }
  };

  const trimAndExportCSV = () => {
    if (!csvFile || !timeData.length) return;
    
    const currentIndex = timeData.findIndex(t => t >= currentTime);
    const trimmedData = timeData.slice(currentIndex).map((time, i) => {
      return `${time},${forceData1[currentIndex + i]},${forceData2[currentIndex + i]}`;
    });
    
    const blob = new Blob([`Time,Force1,Force2\n${trimmedData.join('\n')}`], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'trimmed-data.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const chartData = {
    labels: timeData,
    datasets: [
      {
        label: 'Force Plate 1 (Fz)',
        data: forceData1,
        borderColor: 'blue',
        borderWidth: 0.5,
        tension: 0.1
      },
      {
        label: 'Force Plate 2 (Fz)',
        data: forceData2,
        borderColor: 'green',
        borderWidth: 0.5,
        tension: 0.1
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    scales: {
      y: {
        min: -500,
        max: 2000,
        title: {
          display: true,
          text: 'Force (N)'
        }
      },
      x: {
        title: {
          display: true,
          text: 'Time (s)'
        }
      }
    },
    plugins: {
      annotation: {
        annotations: {
          line1: {
            type: 'line',
            xMin: timeData[currentTime],
            xMax: timeData[currentTime],
            borderColor: 'red',
            borderWidth: 2,
          }
        }
      }
    }
  };

  return (
    <div className="p-4">
      <div className="mb-4 flex gap-4">
        <button
          className={`px-4 py-2 rounded ${activeTab === 'video' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('video')}
        >
          Video Analysis
        </button>
        <button
          className={`px-4 py-2 rounded ${activeTab === 'force' ? 'bg-blue-500 text-white' : 'bg-gray-200'}`}
          onClick={() => setActiveTab('force')}
        >
          Force Data Analysis
        </button>
      </div>

      <div className="mb-4">
        <input
          type="file"
          accept="video/*"
          onChange={handleVideoUpload}
          className="mr-4"
        />
        <input
          type="file"
          accept=".csv"
          onChange={handleCSVUpload}
        />
      </div>

      {activeTab === 'video' && (
        <div className="bg-white rounded-lg p-4">
          <video
            ref={videoRef}
            controls
            className="w-full max-h-[500px] bg-black mb-4"
          />
          <div className="flex items-center gap-4 mb-4">
            <button
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={() => moveFrame(-1)}
            >
              ◀
            </button>
            <div className="text-sm">
              Frame: {currentFrame} / {totalFrames}
            </div>
            <input
              type="range"
              min="0"
              max={totalFrames}
              value={currentFrame}
              className="flex-1"
              onChange={(e) => {
                const frame = parseInt(e.target.value);
                setCurrentFrame(frame);
                if (videoRef.current) {
                  videoRef.current.currentTime = frame / 30;
                }
              }}
            />
            <button
              className="px-4 py-2 bg-gray-200 rounded"
              onClick={() => moveFrame(1)}
            >
              ▶
            </button>
          </div>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-400"
            onClick={trimAndExportVideo}
            disabled={isExporting}
          >
            {isExporting ? "Processing..." : "Trim & Export Video"}
          </button>
        </div>
      )}

      {activeTab === 'force' && (
        <div className="bg-white rounded-lg p-4">
          <div className="mb-4" style={{ height: '400px' }}>
            <Line data={chartData} options={chartOptions} />
          </div>
          <div className="text-sm mb-2">
            Time: {timeData[currentTime]?.toFixed(3) || 0} seconds
          </div>
          <input
            type="range"
            min={0}
            max={timeData.length - 1}
            value={currentTime}
            className="w-full mb-4"
            onChange={(e) => setCurrentTime(parseInt(e.target.value))}
          />
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded"
            onClick={trimAndExportCSV}
          >
            Trim & Export CSV
          </button>
        </div>
      )}
    </div>
  );
}
