package org.streampipes.manager.monitoring.runtime;

import org.streampipes.commons.config.old.ClientConfiguration;
import org.streampipes.commons.exceptions.NoMatchingFormatException;
import org.streampipes.commons.exceptions.NoMatchingProtocolException;
import org.streampipes.commons.exceptions.NoMatchingSchemaException;
import org.streampipes.manager.operations.Operations;
import org.streampipes.messaging.EventListener;
import org.streampipes.messaging.kafka.StreamPipesKafkaConsumer;
import org.streampipes.model.client.pipeline.Pipeline;
import org.streampipes.model.impl.EventStream;
import org.streampipes.model.impl.graph.SepDescription;
import org.streampipes.storage.impl.PipelineStorageImpl;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URISyntaxException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 
 *  
 */
public class SepStoppedMonitoring implements EpRuntimeMonitoring<SepDescription>, Runnable {

	private Map<String, List<PipelineObserver>> streamToObserver;
	private Map<String, Pipeline> streamToStoppedMonitoringPipeline;
	private StreamPipesKafkaConsumer kafkaConsumerGroup;

	@Override
	public boolean register(PipelineObserver observer) {

		try {
			Pipeline pipeline = new PipelineStorageImpl().getPipeline(observer.getPipelineId());

			List<EventStream> allStreams = new ArrayList<>();
			pipeline.getStreams().forEach((s) -> allStreams.add(s));

			for (EventStream s : allStreams) {
				if (streamToObserver.get(s.getElementId()) == null) {
					List<PipelineObserver> po = new ArrayList<>();
					po.add(observer);

					// TODO fix this s.getSourceId() is always null
					String streamId = s.getElementId();
					String sourceId = streamId.substring(0, streamId.lastIndexOf("/"));

					streamToObserver.put(streamId, po);
					Pipeline p = new SepStoppedMonitoringPipelineBuilder(sourceId, streamId).buildPipeline();
					Operations.startPipeline(p, false, false, false);
					streamToStoppedMonitoringPipeline.put(streamId, p);

				} else {
					streamToObserver.get(s.getElementId()).add(observer);
				}
			}

		} catch (URISyntaxException e) {
			e.printStackTrace();
		} catch (NoMatchingFormatException e) {
			e.printStackTrace();
		} catch (NoMatchingSchemaException e) {
			e.printStackTrace();
		} catch (NoMatchingProtocolException e) {
			e.printStackTrace();
		} catch (Exception e) {
			e.printStackTrace();
		}

		return false;
	}

	@Override
	public boolean remove(PipelineObserver observer) {

		Pipeline pipeline = new PipelineStorageImpl().getPipeline(observer.getPipelineId());
		List<EventStream> streams = pipeline.getStreams();

		for (EventStream sc : streams) {
			String streamId = sc.getElementId();
			List<PipelineObserver> po = streamToObserver.get(streamId);
			if (po.size() == 1) {
				streamToObserver.remove(streamId);
				
				Operations.stopPipeline(streamToStoppedMonitoringPipeline.get(streamId), false, false, false);
				streamToStoppedMonitoringPipeline.remove(streamId);
			} else {
				po.remove(observer);
			}

		}

		return false;
	}

	private class KafkaCallback implements EventListener<byte[]> {

		@Override
		public void onEvent(byte[] payload) {
			String str = new String(payload, StandardCharsets.UTF_8);
			JSONObject jo = new JSONObject(str);

			List<PipelineObserver> listPos = streamToObserver.get(jo.get("topic"));
			for (PipelineObserver po : listPos) {
				po.update();
			}
			
			
		}

	}

	@Override
	public void run() {
		streamToObserver = new HashMap<>();
		streamToStoppedMonitoringPipeline = new HashMap<>();

		String topic = "internal.streamepipes.sec.stopped";

		kafkaConsumerGroup = new StreamPipesKafkaConsumer(ClientConfiguration.INSTANCE.getZookeeperUrl(), topic,
				new KafkaCallback());
		Thread thread = new Thread(kafkaConsumerGroup);
		thread.start();

	}

	public static void main(String[] args) throws IOException {
		SepStoppedMonitoring monitoring = new SepStoppedMonitoring();
		monitoring.run();

		// Montrac 01
		String id = "baaaf5b2-5412-4ac1-a7eb-04aeaf0e12b8";
		PipelineObserver observer1 = new PipelineObserver(id);
		
		// Montrac 02
		id = "ef915142-2a08-4166-8bea-8d946ae31cd6";
		PipelineObserver observer2 = new PipelineObserver(id);

		// Random Number Stream
		id = "b3c0b6ad-05df-4670-a078-83775eeb550b";
		PipelineObserver observer3 = new PipelineObserver(id);
				
		monitoring.register(observer1);
		monitoring.register(observer2);
		monitoring.register(observer3);

		BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
		String s = br.readLine();
		monitoring.remove(observer1);
		monitoring.remove(observer2);
		monitoring.remove(observer3);
		System.out.println("laalal");
	}
}