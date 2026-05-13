from app.infrastructure.db.models import NodeConfig


class NodeConfigRepository:
    def __init__(self, session):
        self.session = session

    def create(self, node_config: NodeConfig):
        self.session.add(node_config)
        self.session.flush()
        return node_config

    def update(self, config_id, config_data: dict):
        existing = self.session.get(NodeConfig, config_id)
        if existing is None:
            return None
        existing.config = config_data
        self.session.commit()
        self.session.refresh(existing)
        return existing

    def delete(self, node_config_id):
        node_config = self.session.get(NodeConfig, node_config_id)
        self.session.delete(node_config)
        self.session.commit()
        self.session.refresh(node_config)
        return node_config

    def get_node_config(self, node_config_id):
        return self.session.get(NodeConfig, node_config_id)
